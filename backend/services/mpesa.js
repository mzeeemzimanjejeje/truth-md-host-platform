const axios = require('axios');

const BASE_URL = 'https://payflow.top/api/v2';

function getHeaders() {
    return {
        'X-API-Key': process.env.PAYFLOW_API_KEY,
        'X-API-Secret': process.env.PAYFLOW_API_SECRET,
        'Content-Type': 'application/json'
    };
}

function formatPhone(phone) {
    return phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
}

async function initiateSTKPush({ phone, amount, accountRef, description, callbackUrl }) {
    const formattedPhone = formatPhone(phone);

    const payload = {
        payment_account_id: Number(process.env.PAYFLOW_ACCOUNT_ID),
        phone: formattedPhone,
        amount: Math.ceil(amount),
        reference: accountRef,
        description
    };

    const response = await axios.post(`${BASE_URL}/stkpush.php`, payload, {
        headers: getHeaders()
    });

    return response.data;
}

module.exports = { initiateSTKPush };
