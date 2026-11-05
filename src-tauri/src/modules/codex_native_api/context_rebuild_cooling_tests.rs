//! Synthetic loopback accounts only: cold owner A must not trap portable history.
use super::*;

fn exec_history() -> Vec<Value> {
    let mut history = vec![
        message("user", "Keep the completed assets; continue remaining work"),
        json!({"type":"message","role":"user","content":[
            {"type":"input_image","image_url":"data:image/png;base64,c3ludGhldGlj"}
        ]}),
        json!({"type":"custom_tool_call","name":"exec","call_id":"finished-exec",
            "input":"synthetic completed work","status":"completed"}),
    ];
    // A single code-mode call can produce notifications/yields and a final
    // result. These are four historical results, not four tool executions.
    for index in 0..4 {
        history.push(json!({"type":"custom_tool_call_output","name":"exec",
            "call_id":"finished-exec","id":format!("exec-result-{index}"),
            "output":format!("saved result {index}")}));
    }
    history
}

#[tokio::test]
async fn juling_cooldown_complete_history_switches_account_without_replaying_tools() {
    for streaming in [false, true] {
        for full in [false, true] {
            let fixture = Fixture::new(
                true,
                vec![Step::Complete("a-exec-history", None)],
                vec![Step::Complete("b-continued", None)],
            ).await;
            let history = exec_history();
            let initial = fixture.post(&body(history.clone(), None, false), None).await;
            assert_eq!(initial.status(), 200);
            let _: Value = initial.json().await.unwrap();
            fixture.host.cooling_a.store(true, Ordering::SeqCst);

            let mut expected = history;
            expected.push(message("assistant", "answer-a-exec-history"));
            expected.push(message("user", "Continue without regenerating saved images"));
            let input = if full {
                expected.clone()
            } else {
                vec![expected.last().unwrap().clone()]
            };
            let request = body(input, Some("a-exec-history"), streaming);
            let unchanged = request.clone();
            let response = tokio::time::timeout(
                Duration::from_secs(5), fixture.post(&request, None)
            ).await.expect("must not wait for the owner's four-hour cooldown");
            assert_eq!(response.status(), 200);
            assert!(response.text().await.unwrap().contains("b-continued"));
            let sent = fixture.sent();
            assert_eq!(sent.iter().map(|r| r.account.as_str()).collect::<Vec<_>>(), vec!["a", "b"]);
            assert_fresh(&sent[0], &sent[1], json!(expected));
            assert_eq!(request, unchanged);
            assert_eq!(fixture.active().unwrap().0, "b");
            fixture.assert_owner("a-exec-history", "a");
            fixture.assert_owner("b-continued", "b");
            fixture.finish().await;
        }
    }
}

#[tokio::test]
async fn juling_cooldown_incomplete_history_preserves_owner_and_reports_recovery() {
    use crate::modules::codex_native_api::identity::rebuild::paired_tools;
    let valid = exec_history();
    assert!(paired_tools(&valid));
    let call = valid[2].clone();
    let output = valid[3].clone();
    let mut unfinished = call.clone();
    unfinished["status"] = json!("in_progress");
    let mut mismatched = output.clone();
    mismatched["type"] = json!("function_call_output");
    let mut wrong_name = output.clone();
    wrong_name["name"] = json!("different-tool");
    for invalid in [
        vec![output.clone()],
        vec![output.clone(), call.clone()],
        vec![call.clone()],
        vec![call.clone(), call.clone(), output.clone()],
        vec![call.clone(), mismatched],
        vec![call.clone(), output.clone(), wrong_name],
        vec![unfinished, output.clone(), output.clone()],
        vec![json!({"type":"function_call","name":"exec","call_id":"finished-exec","arguments":"{}"}),
            json!({"type":"function_call_output","call_id":"finished-exec","output":"first"}),
            json!({"type":"function_call_output","call_id":"finished-exec","output":"duplicate"})],
    ] {
        assert!(!paired_tools(&invalid), "must not admit missing or conflicting tool evidence");
    }

    let fixture = Fixture::new(true, vec![Step::Complete("a-root", None)], vec![]).await;
    fixture.root().await;
    let before = fixture.active();
    fixture.host.cooling_a.store(true, Ordering::SeqCst);
    let request = body(vec![output], Some("a-root"), false);
    let response = fixture.post(&request, None).await;
    assert_eq!(response.status(), 503);
    assert_eq!(response.headers()["retry-after"], "14400");
    let error: Value = response.json().await.unwrap();
    assert_eq!(error["error"]["code"], "account_cooling");
    assert_eq!(error["error"]["recovery"], "resend_complete_context_or_wait");
    assert_eq!(error["error"]["automatic_account_switch"], "blocked_unverified_history");
    assert_eq!(fixture.active(), before);
    assert_eq!(fixture.sent().len(), 1, "unverified history must never reach B");
    fixture.assert_owner("a-root", "a");
    fixture.finish().await;
}
