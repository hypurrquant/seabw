// For the mainnet staticcall suite we MUST allow defi-cli child-process spawns
// (otherwise quotes are never produced) and we hit real public RPCs.
process.env.DEFIPILOT_ENV = "prod";
delete process.env.DEFIPILOT_DEFI_CLI;
delete process.env.DEFIPILOT_USE_FIXTURES;
process.env.AUDIT_SALT = "mainnet-test";
