const axios = require('axios');

const FROM_ADDRESS = 'TRUTH Host Platform <noreply@courtneytech.xyz>';
const RESEND_API   = 'https://api.resend.com/emails';

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmail({ to, subject, html }) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set — skipping email');
        return;
    }
    const res = await axios.post(
        RESEND_API,
        { from: FROM_ADDRESS, to: Array.isArray(to) ? to : [to], subject, html },
        {
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        }
    );
    return res.data;
}

async function sendOTPEmail(to, username, otp) {
    await sendEmail({
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
    await sendEmail({
        to: 'noreply@hosts.courtneytech.xyz',
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

async function sendWelcomeEmail(to, username) {
    await sendEmail({
        to,
        subject: 'Welcome to TRUTH Host Platform 🎉',
        html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;background:#0a192f;color:#e6f1ff;padding:36px;border-radius:14px;border:1px solid #172a45;">
            <h2 style="color:#64ffda;text-align:center;margin-bottom:4px;">✦ TRUTH Host Platform</h2>
            <p style="text-align:center;color:#8892b0;font-size:0.85rem;margin-top:0;">Account Verified</p>
            <p style="margin-top:24px;">Hi <strong>${username}</strong>, welcome aboard! 🎉</p>
            <p style="color:#ccd6f6;">Your email has been verified and your account is ready. You can now deploy and manage your WhatsApp bots from your dashboard.</p>
            <div style="text-align:center;margin:32px 0;">
                <a href="https://hosts.courtneytech.xyz/dashboard.html"
                   style="background:#64ffda;color:#0a192f;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;display:inline-block;">
                   Go to Dashboard
                </a>
            </div>
            <p style="color:#8892b0;font-size:0.85rem;">You start with <strong style="color:#64ffda;">10 free coins</strong> — enough to deploy your first bot.</p>
            <hr style="border:none;border-top:1px solid #172a45;margin:24px 0;">
            <p style="color:#8892b0;font-size:0.8rem;text-align:center;">TRUTH Host Platform &nbsp;|&nbsp; hosts.courtneytech.xyz</p>
        </div>`
    });
}

async function sendBuyerReceiptEmail(to, username, coins, amount, receipt, packageName) {
    const date = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    await sendEmail({
        to,
        subject: `✅ Payment Confirmed – ${coins} coins added to your wallet`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0a192f;color:#e6f1ff;padding:36px;border-radius:14px;border:1px solid #172a45;">
            <h2 style="color:#64ffda;text-align:center;margin-bottom:4px;">✦ TRUTH Host Platform</h2>
            <p style="text-align:center;color:#8892b0;font-size:0.85rem;margin-top:0;">Payment Receipt</p>
            <p style="margin-top:24px;">Hi <strong>${username}</strong>, your payment was received successfully!</p>
            <div style="background:#172a45;border-radius:10px;padding:22px;margin:24px 0;border:1px solid #1e3a5f;">
                <table style="width:100%;border-collapse:collapse;">
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
                    <tr style="border-bottom:1px solid #1e3a5f;">
                        <td style="padding:10px 0;color:#8892b0;">Status</td>
                        <td style="padding:10px 0;text-align:right;color:#64ffda;font-weight:700;">✅ Confirmed</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 0;color:#8892b0;">Date</td>
                        <td style="padding:10px 0;text-align:right;color:#ccd6f6;">${date}</td>
                    </tr>
                </table>
            </div>
            <p style="color:#ccd6f6;">Your coins have been added to your wallet. Head to your dashboard to deploy a bot!</p>
            <div style="text-align:center;margin:24px 0;">
                <a href="https://hosts.courtneytech.xyz/dashboard.html"
                   style="background:#64ffda;color:#0a192f;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">
                   Go to Dashboard
                </a>
            </div>
            <hr style="border:none;border-top:1px solid #172a45;margin:24px 0;">
            <p style="color:#8892b0;font-size:0.8rem;text-align:center;">TRUTH Host Platform &nbsp;|&nbsp; hosts.courtneytech.xyz</p>
        </div>`
    });
}

module.exports = { generateOTP, sendOTPEmail, sendWelcomeEmail, sendPurchaseEmail, sendBuyerReceiptEmail };
