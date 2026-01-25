import dotenv from "dotenv"

dotenv.config()

const env = process.env

const config = {
  app: {
    port: Number(env.PORT || 8787),
    jsonLimit: "1mb",
    host: "0.0.0.0",
  },
  smtp: {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    secure: env.SMTP_SECURE === "true",
    from: env.SMTP_FROM || env.SMTP_USER,
  },
  contact: {
    endpointPath: "/api/contact",
    receiver: env.CONTACT_FORM_RECEIVER,
    subjectPrefix: "Neue Kontaktanfrage",
    confirmSubject: "Danke für Ihre Nachricht",
    confirmBody: "Vielen Dank für Ihre Nachricht. Ich werde mich so schnell wie möglich bei Ihnen melden.",
    confirmReplyTo: "",
    maxMessageLength: 5000,
    maxNameLength: 200,
    minSubmitMs: 4000,
    honeypotField: "website",
    rateWindowMs: 15 * 60 * 1000,
    rateMax: 5,
    placeholders: {
      emptyService: "-",
    },
    templates: {
      adminSubject: "{subjectPrefix} von {name}",
      adminBody:
        "Name: {name}\nE-Mail: {email}\nLeistungsbereich: {service}\n\nNachricht:\n{message}",
    },
    errorMessages: {
      required: "Name, E-Mail und Nachricht sind erforderlich.",
      nameTooLong: "Name ist zu lang.",
      messageTooLong: "Nachricht ist zu lang.",
      spam: "Spam erkannt.",
      tooFast: "Bitte senden Sie das Formular nach kurzer Wartezeit erneut.",
      rateLimit: "Zu viele Anfragen. Bitte später erneut versuchen.",
      sendFailure: "E-Mail konnte nicht gesendet werden.",
      smtpMissing:
        "Missing SMTP configuration. Please set environment variables.",
    },
  },
  logMessages: {
    apiListening: "Contact API listening on {url}",
    errorPrefix: "Contact form error:",
  },
}

export { config }

