import express from "express"
import nodemailer from "nodemailer"
import rateLimit from "express-rate-limit"
import { config } from "./config.js"

const app = express()
app.set("trust proxy", config.app.trustProxy)
app.use(express.json({ limit: config.app.jsonLimit }))

const contactLimiter = rateLimit({
  windowMs: config.contact.rateWindowMs,
  max: config.contact.rateMax,
  standardHeaders: config.contact.rateStandardHeaders,
  legacyHeaders: config.contact.rateLegacyHeaders,
  message: { error: config.contact.errorMessages.rateLimit },
})

function renderTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "")
}

function getTransporter() {
  const { host, port, user, pass, secure } = config.smtp

  if (!host || !port || !user || !pass) {
    throw new Error(config.contact.errorMessages.smtpMissing)
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
}

app.get(config.app.healthPath, (_req, res) => res.json({ ok: true }))

app.post(config.contact.endpointPath, contactLimiter, async (req, res) => {
  try {
    const { name, email, service, message } = req.body || {}
    const honeypot = req.body?.[config.contact.honeypotField]

    if (!name || !email || !message) {
      return res.status(400).json({ error: config.contact.errorMessages.required })
    }
    if (honeypot) {
      return res.status(400).json({ error: config.contact.errorMessages.spam })
    }

    const submittedAtMs = Number(config.contact.timestampFields.map(field => req.body[field]).find(value => value != null))
    if (!Number.isFinite(submittedAtMs) || Date.now() - submittedAtMs < config.contact.minSubmitMs) {
      return res.status(400).json({ error: config.contact.errorMessages.tooFast })
    }
    if (name.length > config.contact.maxNameLength) {
      return res.status(400).json({ error: config.contact.errorMessages.nameTooLong })
    }
    if (message.length > config.contact.maxMessageLength) {
      return res.status(400).json({ error: config.contact.errorMessages.messageTooLong })
    }

    const transporter = getTransporter()
    const fromAddress = config.smtp.from

    const adminSubject = renderTemplate(config.contact.templates.adminSubject, {
      subjectPrefix: config.contact.subjectPrefix,
      name,
    })
    const adminBody = renderTemplate(config.contact.templates.adminBody, {
      name,
      email,
      service: service || config.contact.placeholders.emptyService,
      message,
    })

    await transporter.sendMail({
      from: fromAddress,
      to: config.contact.receiver,
      replyTo: email,
      subject: adminSubject,
      text: adminBody,
    })

    if (config.contact.confirmationEnabled) {
      await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject: config.contact.confirmSubject,
        text: config.contact.confirmBody,
        ...(config.contact.confirmReplyTo ? { replyTo: config.contact.confirmReplyTo } : {}),
      })
    }

    return res.json({ ok: true })
  } catch (error) {
    console.error(config.logMessages.errorPrefix, error)
    return res.status(500).json({ error: config.contact.errorMessages.sendFailure })
  }
})

app.listen(config.app.port, config.app.host, () => {
  const url = `http://${config.app.host}:${config.app.port}`
  console.log(renderTemplate(config.logMessages.apiListening, { url }))
})

