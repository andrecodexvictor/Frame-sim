// Single dependency-free entry point. Dynamic imports keep suites sequential:
// provider tests temporarily replace process.env/global fetch and therefore must
// never overlap an orchestrator or router suite.
export {};
await import('./brain.test.js');
await import('./orchestrator.test.js');
await import('./router.test.js');
await import('./racing.test.js');
await import('./self_improvement.test.js');
await import('./config_tools.test.js');
await import('./provider_gateway.test.js');
await import('./server.test.js');
