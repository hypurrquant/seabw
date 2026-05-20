// Global test setup. Force demo env so the prod calldata-mandatory gate
// doesn't fire on placeholder fixtures, and disable defi-cli child-process
// spawns so tests don't depend on a binary.
process.env.DEFIPILOT_ENV = "demo";
process.env.DEFIPILOT_DEFI_CLI = "off";
process.env.DEFIPILOT_USE_FIXTURES = "true";
process.env.AUDIT_SALT = "test";
