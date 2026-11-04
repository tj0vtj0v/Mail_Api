// Run from /docker using the README command. SMTP is mocked throughout.
import assert from 'node:assert/strict'
import nodemailer from 'nodemailer'
import { config, mergeConfig } from './config.js'

const parent = { nested: { keep: 1, replace: 2 }, array: ['a'], flag: true, text: 'parent' }
assert.deepEqual(mergeConfig(parent, { nested: { replace: 0 }, array: ['b'], flag: false, text: '' }),
  { nested: { keep: 1, replace: 0 }, array: ['b'], flag: false, text: '' })
assert.equal(parent.nested.replace, 2)
assert.throws(() => mergeConfig({}, JSON.parse('{"__proto__": {"polluted": true}}')))
assert.equal(config.contact.rateMax, 5)
assert.equal(config.contact.rateWindowMs, 900000)
assert.ok(config.contact.confirmBody)
assert.ok(config.contact.templates.adminBody)
assert.ok(config.contact.receiver)

const sent = []
nodemailer.createTransport = () => ({ sendMail: async mail => sent.push(mail) })
config.contact.confirmReplyTo = 'reply@example.invalid'
await import('./server.mjs')
const submit = (body, ip) => fetch(`http://127.0.0.1:${config.app.port}${config.contact.endpointPath}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
  body: JSON.stringify(body),
})
const body = { name: 'Test', email: 'visitor@example.invalid', message: 'Test', service: 'Example' }
for (const field of config.contact.timestampFields) {
  const response = await submit({ ...body, [field]: Date.now() - 5000 }, '192.0.2.1')
  assert.equal(response.status, 200)
}
assert.equal(sent[0].to, config.contact.receiver)
assert.equal(sent[0].replyTo, body.email)
assert.equal(sent[1].replyTo, 'reply@example.invalid')
assert.equal(sent[1].text, config.contact.confirmBody)
config.contact.confirmReplyTo = ''
let before = sent.length
assert.equal((await submit({ ...body, submittedAt: Date.now() - 5000 }, '192.0.2.2')).status, 200)
assert.equal(sent.length, before + 2)
assert.equal(Object.hasOwn(sent.at(-1), 'replyTo'), false)
config.contact.confirmationEnabled = false
before = sent.length
assert.equal((await submit({ ...body, submittedAt: Date.now() - 5000 }, '192.0.2.3')).status, 200)
assert.equal(sent.length, before + 1)
for (let i = 0; i < 5; i++) assert.equal((await submit({}, '192.0.2.4')).status, 400)
assert.equal((await submit({}, '192.0.2.4')).status, 429)
assert.equal((await submit({}, '192.0.2.5')).status, 400)
console.log('PASS: inheritance, instance config, reply-to, confirmation toggle, timestamp fields and per-IP rate limit; no email sent')
process.exit(0)
