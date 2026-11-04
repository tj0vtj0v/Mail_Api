import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import dotenv from "dotenv"

// Nested objects merge; arrays and scalar values replace the parent value.
export function mergeConfig(parent, overrides) {
  const result = { ...parent }
  for (const [key, value] of Object.entries(overrides)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) {
      throw new Error(`Invalid configuration key: ${key}`)
    }
    result[key] = value !== null && typeof value === "object" && !Array.isArray(value)
      ? mergeConfig(parent[key] || {}, value)
      : value
  }
  return result
}

const configDir = process.env.CONFIG_DIR || "/app/config"
const defaultsFile = process.env.CONFIG_DEFAULTS_FILE || join(dirname(configDir), "defaults.json")
const readJSON = path => JSON.parse(readFileSync(path, "utf8"))
const config = mergeConfig(readJSON(defaultsFile), readJSON(join(configDir, "config.json")))
const result = dotenv.config({ path: join(configDir, ".env"), override: true })
if (result.error) throw result.error
const env = process.env
// Explicit env values override JSON; absent values retain inherited settings.
const bindings = {
  SMTP_HOST: ["smtp", "host"], SMTP_PORT: ["smtp", "port"],
  SMTP_USER: ["smtp", "user"], SMTP_PASS: ["smtp", "pass"],
  SMTP_SECURE: ["smtp", "secure"], SMTP_FROM: ["smtp", "from"],
  CONTACT_FORM_RECEIVER: ["contact", "receiver"],
  CONTACT_REPLY_TO: ["contact", "confirmReplyTo"],
}
for (const [name, [section, key]] of Object.entries(bindings)) {
  if (env[name] === undefined) continue
  config[section][key] = name === "SMTP_PORT" ? Number(env[name])
    : name === "SMTP_SECURE" ? env[name] === "true" : env[name]
}
config.smtp.from ||= config.smtp.user
if (!config.contact.receiver || !config.contact.timestampFields?.length) {
  throw new Error("Missing contact receiver or timestamp fields in instance configuration")
}
export { config }
