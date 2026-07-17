const axios = require('axios');

const BASE_URL = 'https://courtneytech.xyz/api/mpesa';

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
        phone: formattedPhone,
        amount: Math.ceil(amount),
        accountReference: accountRef,
        description,
        callbackUrl
    };

    const response = await axios.post(`${BASE_URL}/stkpush`, payload, {
        headers: {
            'Authorization': `Bearer ${process.env.PAYFLOW_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

module.exports = { initiateSTKPush };
