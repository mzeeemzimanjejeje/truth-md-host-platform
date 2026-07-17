const nodemailer = require('nodemailer');

function createTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(to, username, otp) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.warn('Email not configured — skipping OTP email');
        return;
    }
    const transporter = createTransporter();
    await transporter.sendMail({
        from: `"TRUTH Host Platform" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Your Login Code – TRUTH Host Platform',
        html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;background:#0a192f;color:#e6f1ff;padding:36px;border-radius:14px;border:1px solid #172a45;">
            <h2 style="color:#64ffda;text-align:center;margin-bottom:4px;">✦ TRUTH Host Platform</h2>
            <p style="text-align:center;color:#8892b0;font-size:0.85rem;margin-top:0;">Verification Code</p>
            <p style="margin-top:24px;">Hi <strong>${username}</strong>,</p>
            <p style="color:#ccd6f6;">Use this code to complete your login. It expires in <strong>10 minutes</strong>.</p>
            <div style="text-align:center;margin:32px 0;">
                <span style="font-size:2.8rem;font-weight:bold;letter-spacing:12px;color:#64ffda;background:#172a45;padding:16px 28px;border-radius:10px;display:inline-block;">${otp}</span>
            </div>
            <p style="color:#8892b0;font-size:0.85rem;">If you did not try to sign in, you can safely ignore this email.</p>
            <hr style="border:none;border-top:1px solid #172a45;margin:24px 0;">
            <p style="color:#8892b0;font-size:0.8rem;text-align:center;">TRUTH Host Platform &nbsp;|&nbsp; Automated Security Code</p>
        </div>`
    });
}

function receiptTable(username, coins, amount, receipt, packageName) {
    const date = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    return `
    <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #1e3a5f;">
            <td style="padding:10px 0;color:#8892b0;">User</td>
            <td style="padding:10px 0;text-align:right;color:#e6f1ff;font-weight:600;">${username}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e3a5f;">
            <td style="padding:10px 0;color:#8892b0;">Package</td>
            <td style="padding:10px 0;text-align:right;color:#e6f1ff;font-weight:600;">${packageName}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e3a5f;">
            <td style="padding:10px 0;color:#8892b0;">Coins Added</td>
            <td style="padding:10px 0;text-align:right;color:#64ffda;font-weight:700;">+${coins} coins</td>
        </tr>
        <tr style="border-bottom:1px solid #1e3a5f;">
            <td style="padding:10px 0;color:#8892b0;">Amount Paid</td>
            <td style="padding:10px 0;text-align:right;color:#e6f1ff;font-weight:600;">Ksh ${amount}</td>
        </tr>
        ${receipt ? `
        <tr style="border-bottom:1px solid #1e3a5f;">
            <td style="padding:10px 0;color:#8892b0;">M-Pesa Code</td>
            <td style="padding:10px 0;text-align:right;color:#64ffda;font-weight:700;letter-spacing:1px;">${receipt}</td>
        </tr>` : ''}
        <tr>
            <td style="padding:10px 0;color:#8892b0;">Status</td>
            <td style="padding:10px 0;text-align:right;color:#64ffda;font-weight:700;">✅ Successful</td>
        </tr>
        <tr>
            <td style="padding:10px 0;color:#8892b0;">Date</td>
            <td style="padding:10px 0;text-align:right;color:#ccd6f6;">${date}</td>
        </tr>
    </table>`;
}

async function sendPurchaseEmail(username, coins, amount, receipt, packageName) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.warn('Email not configured — skipping purchase receipt');
        return;
    }
    const transporter = createTransporter();
    await transporter.sendMail({
        from: `"TRUTH Host Platform" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: `✅ New Payment – ${username} bought ${coins} coins (Ksh ${amount})`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0a192f;color:#e6f1ff;padding:36px;border-radius:14px;border:1px solid #172a45;">
            <h2 style="color:#64ffda;text-align:center;margin-bottom:4px;">✦ TRUTH Host Platform</h2>
            <p style="text-align:center;color:#8892b0;font-size:0.85rem;margin-top:0;">Payment Receipt – Admin Copy</p>
            <p style="margin-top:24px;color:#ccd6f6;">A new coin purchase was completed successfully.</p>
            <div style="background:#172a45;border-radius:10px;padding:22px;margin:24px 0;border:1px solid #1e3a5f;">
                ${receiptTable(username, coins, amount, receipt, packageName)}
            </div>
            <p style="color:#8892b0;font-size:0.8rem;">This is your admin copy. Quote the M-Pesa code as proof of payment when resolving any disputes.</p>
            <hr style="border:none;border-top:1px solid #172a45;margin:24px 0;">
            <p style="color:#8892b0;font-size:0.8rem;text-align:center;">TRUTH Host Platform &nbsp;|&nbsp; Automated Admin Receipt</p>
        </div>`
    });
}

module.exports = { generateOTP, sendOTPEmail, sendPurchaseEmail };
