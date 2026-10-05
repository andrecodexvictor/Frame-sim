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
await import('./nvidia_deepseek.test.js');
await import('./provider_registry.test.js');
await import('./run_manifest.test.js');
await import('./code_snapshot.test.js');
await import('./persona_trace.test.js');
await import('./paired_orchestrator.test.js');
await import('./individual_metrics.test.js');
await import('./synthetic_work.test.js');
await import('./jev_evaluator.test.js');
await import('./evals.test.js');
await import('./online_budget.test.js');
await import('./server.test.js');
