use super::*;
use crate::modules::codex_proxy_catalog_binding as binding;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

struct Fixture {
    root: PathBuf,
    old: Option<std::ffi::OsString>,
    old_data: Option<std::ffi::OsString>,
}
impl Fixture {
    fn new() -> Self {
        let root =
            std::env::temp_dir().join(format!("native-profile-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("resources")).unwrap();
        let old = std::env::var_os("JULING_TOOLS_TEST_DATA_DIR");
        let old_data = std::env::var_os("JULING_TOOLS_DATA_DIR");
        std::env::set_var("JULING_TOOLS_TEST_DATA_DIR", root.join("data"));
        std::env::set_var("JULING_TOOLS_DATA_DIR", root.join("data"));
        Self {
            root,
            old,
            old_data,
        }
    }
    fn resources(&self) -> PathBuf {
        self.root.join("resources")
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if let Some(old) = &self.old {
            std::env::set_var("JULING_TOOLS_TEST_DATA_DIR", old);
        } else {
            std::env::remove_var("JULING_TOOLS_TEST_DATA_DIR");
        }
        if let Some(old) = &self.old_data {
            std::env::set_var("JULING_TOOLS_DATA_DIR", old);
        } else {
            std::env::remove_var("JULING_TOOLS_DATA_DIR");
        }
        let _ = std::fs::remove_dir_all(&self.root);
    }
}
fn binary() -> PathBuf {
    std::env::var_os("JULING_TEST_MIHOMO")
        .expect("verified test engine required")
        .into()
}
fn command(binary: &Path) -> tokio::process::Command {
    let mut command = tokio::process::Command::new(binary);
    command.kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    command
}
fn profile(config: Value) -> NativeProfile {
    NativeProfile {
        snapshot_id: String::new(),
        config,
        files: Default::default(),
        resource_directory: String::new(),
        rules_name: "PROFILE".into(),
        names: Default::default(),
        members: Default::default(),
    }
}
async fn headers(socket: &mut tokio::net::TcpStream) -> String {
    let mut data = Vec::new();
    while !data.ends_with(b"\r\n\r\n") {
        data.push(socket.read_u8().await.unwrap());
        assert!(data.len() < 8192);
    }
    String::from_utf8(data).unwrap()
}

#[test]
fn native_configuration_preserves_rules_dns_options_and_isolates_ingress() {
    let raw = json!({"geo-auto-update":true,"mixed-port":7890,"port":7891,"allow-lan":true,"listeners":[{"type":"socks","port":8888}],
        "external-controller":"0.0.0.0:9090","tun":{"enable":true},"ntp":{"enable":true,"write-to-system":true},
        "dns":{"enable":true,"listen":"0.0.0.0:53","nameserver":["system"]},"hosts":{"synthetic.test":"127.0.0.1"},
        "proxies":[{"name":"account-node","type":"http","server":"localhost","port":9}],
        "proxy-providers":{"A":{"type":"inline","payload":[],"age-secret-key":"synthetic","override":{"override-expr":[".udp = true"]}}},
        "rules":["DOMAIN,synthetic.test,DIRECT","MATCH,account-node"]});
    let profile = profile(raw.clone());
    let config =
        configuration(&profile, &json!({"rules":true}), 12345, "user", "password").unwrap();
    assert_eq!(config["rules"], raw["rules"]);
    assert_eq!(config["hosts"], raw["hosts"]);
    assert_eq!(config["geo-auto-update"], false);
    assert_eq!(config["proxy-providers"], raw["proxy-providers"]);
    assert_eq!(config["mixed-port"], 12345);
    assert_eq!(config["allow-lan"], false);
    assert!(config.get("port").is_none() && config.get("listeners").is_none());
    assert_eq!(config["dns"]["nameserver"], json!(["system"]));
    assert!(config["dns"].get("listen").is_none());
    assert_eq!(config["tun"]["enable"], false);
    assert_eq!(config["ntp"]["write-to-system"], false);
    let selected =
        configuration(&profile, &json!({"name":"account-node"}), 12345, "u", "p").unwrap();
    assert_eq!(selected["proxy-groups"][0]["name"], "account-node_");
    assert_eq!(selected["rules"], json!(["MATCH,account-node_"]));
}

#[test]
fn resource_relocation_never_mistakes_transport_paths_or_encoded_keys_for_files() {
    let directory = tempfile::tempdir().unwrap();
    let local_path = directory.path().join("local.yaml");
    let mut config = json!({"proxies":[{"name":"V","type":"vless","ws-opts":{"path":"/ws"}},
        {"name":"WG","type":"wireguard","private-key":"/encoded-key"}],
        "proxy-providers":{"A":{"type":"file","path":local_path}}});
    relocate_files(&mut config, Some(directory.path())).unwrap();
    assert_eq!(config["proxies"][0]["ws-opts"]["path"], "/ws");
    assert_eq!(config["proxies"][1]["private-key"], "/encoded-key");
    assert_eq!(config["proxy-providers"]["A"]["path"], "local.yaml");
    assert!(!assets::relative("../private"));
    assert!(!assets::relative("/private"));
}

#[test]
fn verge_default_repairs_are_applied_without_replacing_native_provider_semantics() {
    let config = document("Mode: script\nProxies:\n - {name: HY, type: hysteria, alpn: h3}\nproxy-providers:\n P: {type: inline, payload: []}\nproxy-groups:\n - {name: A, type: select, proxies: [Missing, HY, DIRECT]}\n - {name: B, type: select, use: [Gone, P], proxies: [ProviderNode]}\n").unwrap().unwrap();
    let config = verge::normalize(config);
    assert_eq!(config["mode"], "rule");
    assert_eq!(config["proxies"][0]["alpn"], json!(["h3"]));
    assert_eq!(
        config["proxy-groups"][0]["proxies"],
        json!(["HY", "DIRECT"])
    );
    assert_eq!(config["proxy-groups"][1]["use"], json!(["P"]));
    assert_eq!(
        config["proxy-groups"][1]["proxies"],
        json!(["ProviderNode"])
    );
}

#[test]
fn native_snapshot_references_are_small_and_resource_reads_are_not_part_of_validation() {
    let raw =
        json!({"type":KIND,"profileId":"a".repeat(64),"target":{"name":"Node"},"selections":{}});
    assert!(valid_reference(&raw));
    assert!(!valid_reference(
        &json!({"type":KIND,"profileId":"../../secret","target":{},"selections":{}})
    ));
    assert!(
        document("proxy-providers:\n  local: {type: file, path: proxies.yaml}")
            .unwrap()
            .is_some()
    );
    assert!(document("trojan://synthetic@localhost:9")
        .unwrap()
        .is_none());
}

#[tokio::test]
async fn missing_file_directory_is_reported_before_starting_engine() {
    let error = prepare(
        json!({"proxy-providers":{"Local":{"type":"file","path":"local.yaml"}}}),
        String::new(),
        "Rules".into(),
    )
    .await
    .err()
    .unwrap();
    assert_eq!(error, "PROXY_PROFILE_DIRECTORY");
    let inline_fallback = prepare(json!({"proxy-providers":{"Local":{"type":"file","path":"optional.yaml","payload":[{"name":"Node","type":"http","server":"localhost","port":9}]}}}),String::new(),"Rules".into()).await;
    assert!(inline_fallback.is_ok());
}

#[tokio::test]
#[ignore = "verified Mihomo; synthetic encrypted local provider and localhost only"]
async fn native_engine_encrypted_files_expressions_and_snapshot_recovery() {
    let _lock = crate::modules::test_support::env_lock()
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    let binary = binary();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        assert!(headers(&mut socket)
            .await
            .starts_with("CONNECT synthetic.invalid:80 "));
        socket.write_all(b"HTTP/1.1 200 OK\r\n\r\n").await.unwrap();
        assert!(headers(&mut socket).await.starts_with("GET / "));
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 6\r\nConnection: close\r\n\r\nnative")
            .await
            .unwrap();
    });
    let keys = command(&binary)
        .args(["age", "keygen"])
        .output()
        .await
        .unwrap();
    assert!(keys.status.success());
    let keys = String::from_utf8(keys.stdout).unwrap();
    let secret = keys
        .lines()
        .find(|line| line.starts_with("AGE-SECRET-KEY-"))
        .unwrap();
    let public = keys
        .lines()
        .find_map(|line| line.strip_prefix("# public key: "))
        .unwrap();
    let plaintext =
        json!({"proxies":[{"name":"Node","type":"http","server":"127.0.0.1","port":port}]})
            .to_string();
    let mut encrypt = command(&binary)
        .args(["age", "encrypt", public, "-", "-"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    encrypt
        .stdin
        .take()
        .unwrap()
        .write_all(plaintext.as_bytes())
        .await
        .unwrap();
    let encrypted = encrypt.wait_with_output().await.unwrap();
    assert!(encrypted.status.success());
    std::fs::write(f.resources().join("nodes.age"), &encrypted.stdout).unwrap();
    let config = json!({"rule-providers":{"Unrelated":{"type":"inline","payload":[],"behavior":"domain"}},"proxy-providers":{"Local":{"type":"file","path":"nodes.age","age-secret-key":secret,
        "override":{"override-expr":[".name = \"native-\" + .name"]},"filter":"^(?=Node)Node$"}},
        "proxy-groups":[{"name":"Choose","type":"select","use":["Local"]}],"rules":["MATCH,Choose"]});
    let catalog = inspect_with_binary(
        &binary,
        config,
        f.resources().to_string_lossy().into_owned(),
        "Rules".into(),
    )
    .await
    .unwrap();
    let node = catalog
        .nodes
        .iter()
        .find(|n| n.name == "native-Node")
        .unwrap();
    let encoded = binding::encode("s", "Source", &node.id, &catalog, &BTreeMap::new()).unwrap();
    assert!(encoded.len() < 4096);
    assert!(!encoded.contains(secret));
    std::fs::remove_file(f.resources().join("nodes.age")).unwrap();
    let tunnel =
        engine::start_native_inspection(&binary, json!(binding::outbounds(&encoded).unwrap()))
            .await
            .unwrap();
    let client = reqwest::Client::builder()
        .no_proxy()
        .proxy(reqwest::Proxy::all(tunnel.proxy_url()).unwrap())
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    let response = client
        .get("http://synthetic.invalid/")
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    tunnel.stop().await.unwrap();
    assert_eq!(response, "native");
    tokio::time::timeout(Duration::from_secs(3), server)
        .await
        .unwrap()
        .unwrap();
    let persisted = std::fs::read_to_string(f.root.join("data/codex-proxy-assets").join(format!(
        "{}.json",
        catalog.native.as_ref().unwrap().snapshot_id
    )))
    .unwrap();
    assert!(!persisted.contains(secret) && !persisted.contains("native-Node"));
}

#[tokio::test]
#[ignore = "verified Mihomo; synthetic rules, hosts and localhost only"]
async fn native_engine_subscription_rules_use_native_hosts_and_direct_routes() {
    let _lock = crate::modules::test_support::env_lock()
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    std::fs::write(
        f.resources().join("rules.yaml"),
        b"payload:\n - native.test\n",
    )
    .unwrap();
    let binary = binary();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        assert!(headers(&mut socket).await.starts_with("GET / "));
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nrules")
            .await
            .unwrap();
    });
    let config = json!({"proxies":[],"hosts":{"native.test":"127.0.0.1"},"rule-providers":{"Local":{"type":"file","behavior":"domain","path":"rules.yaml"}},"rules":["RULE-SET,Local,DIRECT","MATCH,REJECT"]});
    let catalog = inspect_with_binary(
        &binary,
        config,
        f.resources().to_string_lossy().into(),
        "Rules".into(),
    )
    .await
    .unwrap();
    let item = catalog
        .nodes
        .iter()
        .find(|n| n.protocol == "profile")
        .unwrap();
    let raw = binding::encode("s", "s", &item.id, &catalog, &BTreeMap::new()).unwrap();
    let tunnel = engine::start_native_inspection(&binary, json!(binding::outbounds(&raw).unwrap()))
        .await
        .unwrap();
    let rules = engine::native_request(&tunnel.controller(), "providers/rules", None)
        .await
        .unwrap();
    assert_eq!(rules["providers"]["Local"]["ruleCount"], 1);
    let client = reqwest::Client::builder()
        .no_proxy()
        .proxy(reqwest::Proxy::all(tunnel.proxy_url()).unwrap())
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    let text = client
        .get(format!("http://native.test:{port}/"))
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    tunnel.stop().await.unwrap();
    assert_eq!(text, "rules");
    server.await.unwrap();
}

#[test]
fn native_resources_reject_recursive_downloads_even_with_https_or_fallback_payload() {
    for section in ["proxy-providers", "rule-providers"] {
        for url in ["http://127.0.0.1:9/private", "https://provider.example/sub"] {
            let mut config = json!({"proxies":[]});
            config[section] = json!({"Remote":{"type":"http","url":url,
                "header":{"Authorization":["Bearer synthetic"]},"payload":[]}});
            assert_eq!(profile(config).validate().unwrap_err(), "PROXY_PROFILE_REMOTE_RESOURCE");
        }
        let mut config = json!({"proxies":[]});
        config[section] = json!({"Disguised":{"type":"inline","url":"https://provider.example/sub","payload":[]}});
        assert_eq!(profile(config).validate().unwrap_err(), "PROXY_PROFILE_REMOTE_RESOURCE");
    }
    for config in [
        json!({"proxies":[],"geox-url":{"geoip":"https://provider.example/geoip"}}),
        json!({"proxies":[],"rules":["GEOIP,CN,DIRECT"]}),
        json!({"proxies":[],"rules":["AND,((GEOIP,CN),(NETWORK,TCP)),DIRECT"]}),
        json!({"proxies":[],"dns":{"nameserver-policy":{"geosite:cn":"system"}}}),
        json!({"proxies":[],"dns":{"fallback-filter":{"geoip":true}}}),
    ] {
        assert_eq!(profile(config).validate().unwrap_err(), "PROXY_PROFILE_REMOTE_RESOURCE");
    }
    assert!(profile(json!({"proxies":[],"proxy-providers":{"Local":{"type":"file","path":"local.yaml"}},
        "rule-providers":{"Rules":{"type":"inline","behavior":"domain","payload":["example.test"]}}})).validate().is_ok());
}

#[test]
fn native_rule_files_require_domain_or_ipcidr_before_configuration() {
    for behavior in [None, Some("classical"), Some("unknown")] {
        let mut config = json!({"proxies":[],"rule-providers":{"Local":{"type":"file","path":"rules.yaml"}}});
        if let Some(behavior) = behavior {
            config["rule-providers"]["Local"]["behavior"] = json!(behavior);
        }
        let profile = profile(config);
        assert_eq!(profile.validate().unwrap_err(), "PROXY_PROFILE_REMOTE_RESOURCE");
        assert_eq!(configuration(&profile, &json!({"rules":true}), 12345, "u", "p").unwrap_err(), "PROXY_PROFILE_REMOTE_RESOURCE");
        let outbound = envelope(&profile, json!({"rules":true}), BTreeMap::new());
        assert_eq!(from_outbound(&outbound).err().unwrap(), "PROXY_PROFILE_REMOTE_RESOURCE");
    }
    for behavior in ["domain", "ipcidr"] {
        assert!(profile(json!({"proxies":[],"rule-providers":{"Local":{"type":"file",
            "behavior":behavior,"path":"rules.yaml"}}})).validate().is_ok());
    }
}

#[tokio::test]
async fn cached_native_classical_rule_profile_cannot_bypass_validation() {
    let _lock = crate::modules::test_support::env_lock()
        .lock().unwrap_or_else(|e| e.into_inner());
    let _fixture = Fixture::new();
    let old = profile(json!({"proxies":[],"rule-providers":{"Local":{"type":"file",
        "behavior":"classical","path":"rules.yaml"}},"rules":["RULE-SET,Local,DIRECT"]}));
    let id = assets::put(&serde_json::to_vec(&old).unwrap()).unwrap();
    let reference = json!({"type":KIND,"profileId":id,"target":{"rules":true},"selections":{}});
    assert!(valid_reference(&reference));
    assert_eq!(resolve(reference).await.err().unwrap(), "PROXY_PROFILE_REMOTE_RESOURCE");
}

#[tokio::test]
async fn native_remote_resource_is_rejected_before_engine_start_or_network() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let config = json!({"proxies":[],"proxy-providers":{"Remote":{"type":"http",
        "url":format!("https://{}/synthetic", listener.local_addr().unwrap())}}});
    assert_eq!(inspect_with_binary(Path::new("must-not-start"), config, String::new(), String::new())
        .await.err().unwrap(), "PROXY_PROFILE_REMOTE_RESOURCE");
    assert!(tokio::time::timeout(Duration::from_millis(100), listener.accept()).await.is_err());
}

#[test]
fn yaml_merge_aliases_and_base64_wrappers_reach_the_native_decoder() {
    use base64::Engine;
    let input = "template: &proxy {type: http, server: 127.0.0.1, port: 9}\nproxies:\n - {<<: *proxy, name: Merged}\n";
    let plain = document(input).unwrap().unwrap();
    assert_eq!(plain["proxies"][0]["server"], "127.0.0.1");
    assert!(plain["proxies"][0].get("<<").is_none());
    let encoded = base64::engine::general_purpose::STANDARD.encode(input);
    assert_eq!(document(&encoded).unwrap().unwrap(), plain);
}

#[tokio::test]
#[ignore = "verified Mihomo; restored group choices and composite native bridges"]
async fn native_engine_global_choices_and_composite_strategy_keep_native_routing() {
    let _lock = crate::modules::test_support::env_lock()
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let _f = Fixture::new();
    let binary = binary();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        for _ in 0..2 {
            let (mut socket, _) = listener.accept().await.unwrap();
            headers(&mut socket).await;
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
                .await
                .unwrap();
        }
    });
    let config = json!({"proxies":[],"hosts":{"native.test":"127.0.0.1"},
        "proxy-groups":[{"name":"Choose","type":"select","proxies":["REJECT","DIRECT"]}],"rules":["MATCH,Choose"]});
    let catalog = inspect_with_binary(&binary, config, String::new(), "Rules".into())
        .await
        .unwrap();
    let global = catalog.groups.iter().find(|g| g.name == "GLOBAL").unwrap();
    let choose = catalog.groups.iter().find(|g| g.name == "Choose").unwrap();
    let selections = BTreeMap::from([
        (global.id.clone(), "Choose".into()),
        (choose.id.clone(), "DIRECT".into()),
    ]);
    let global_binding = binding::encode("s", "s", &global.id, &catalog, &selections).unwrap();
    let rules = catalog
        .nodes
        .iter()
        .find(|n| n.protocol == "profile")
        .unwrap();
    let rules_binding = binding::encode("s", "s", &rules.id, &catalog, &selections).unwrap();
    let mut reference = binding::outbounds(&rules_binding).unwrap().remove(0);
    reference["tag"] = json!("native-child");
    let composite = json!([{"type":"mihomo-group","tag":"account-node","group":{"type":"select","name":"account-node","proxies":["native-child"]}},reference]);
    for outbound in [
        json!(binding::outbounds(&global_binding).unwrap()),
        composite,
    ] {
        let tunnel = engine::start_native_inspection(&binary, outbound)
            .await
            .unwrap();
        let client = reqwest::Client::builder()
            .no_proxy()
            .proxy(reqwest::Proxy::all(tunnel.proxy_url()).unwrap())
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap();
        let response = client
            .get(format!("http://native.test:{port}/"))
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();
        assert_eq!(response, "ok");
        tunnel.stop().await.unwrap();
    }
    server.await.unwrap();
}

#[test]
fn forced_nodes_skip_routing_only_downloads_but_keep_dns_rule_sets() {
    let raw = json!({"proxies":[],"rule-providers":{"Route":{"type":"inline","behavior":"domain"},"DNS":{"type":"inline","behavior":"domain"},"IPs":{"type":"inline","behavior":"ipcidr"},"FakeIP":{"type":"inline","behavior":"domain"}},
        "dns":{"nameserver-policy":{"rule-set:DNS":["system"]},"fallback-filter":{"ipcidr":["rule-set:IPs"]},"fake-ip-filter":["RULE-SET,FakeIP,real-ip"]},
        "rules":["RULE-SET,Route,REJECT","MATCH,DIRECT"],"sub-rules":{"extra":["RULE-SET,Route,DIRECT"]}});
    let profile = profile(raw.clone());
    for target in [
        json!({"name":"DIRECT"}),
        json!({"name":"GLOBAL"}),
        json!({"rules":true,"inventory":true}),
    ] {
        let config = configuration(&profile, &target, 12345, "u", "p").unwrap();
        assert!(config["rule-providers"].get("Route").is_none());
        for name in ["DNS", "IPs", "FakeIP"] {
            assert!(config["rule-providers"].get(name).is_some());
        }
        assert!(config.get("sub-rules").is_none());
    }
    let rules = configuration(&profile, &json!({"rules":true}), 12345, "u", "p").unwrap();
    assert_eq!(rules["rule-providers"], raw["rule-providers"]);
    assert_eq!(rules["rules"], raw["rules"]);
    assert_eq!(rules["sub-rules"], raw["sub-rules"]);
}

#[test]
fn inventory_rejects_implicit_provider_download_routing() {
    let raw = json!({"proxies":[],"proxy-providers":{"Remote":{"type":"http","url":"https://example.invalid/nodes"}},
        "rule-providers":{"Bootstrap":{"type":"http"}},"rules":["RULE-SET,Bootstrap,DIRECT","MATCH,REJECT"]});
    let config = configuration(
        &profile(raw.clone()),
        &json!({"rules":true,"inventory":true}),
        12345,
        "u",
        "p",
    )
    .unwrap_err();
    assert_eq!(config, "PROXY_PROFILE_REMOTE_RESOURCE");
}
