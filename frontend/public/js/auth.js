document.addEventListener('DOMContentLoaded', () => {

    // ── Helpers ───────────────────────────────────────────────────────────
    function setLoading(textEl, spinnerEl, loading, label) {
        textEl.textContent = loading ? label : textEl.dataset.original;
        spinnerEl.style.display = loading ? 'inline-block' : 'none';
    }

    async function verifyOTP(userId, otp) {
        const res  = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, otp })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        return data.token;
    }

    async function resendOTP(userId) {
        const res  = await fetch('/api/auth/resend-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        alert(data.msg || data.error || 'Done');
    }

    // ── SIGNUP ────────────────────────────────────────────────────────────
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        // Pre-fill referral code from URL ?ref=
        const ref = new URLSearchParams(window.location.search).get('ref');
        if (ref) document.getElementById('referralCode').value = ref;

        let pendingUserId = null;

        const signupText    = document.getElementById('signupText');
        const signupSpinner = document.getElementById('signupSpinner');
        signupText.dataset.original = signupText.textContent;

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoading(signupText, signupSpinner, true, 'Creating account…');
            try {
                const res  = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username:     document.getElementById('username').value.trim(),
                        email:        document.getElementById('email').value.trim(),
                        password:     document.getElementById('password').value,
                        referralCode: document.getElementById('referralCode').value.trim()
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Registration failed');

                // Admin gets a token directly — skip OTP
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    window.location.href = 'dashboard.html';
                    return;
                }

                pendingUserId = data.userId;
                document.getElementById('displayEmail').textContent = document.getElementById('email').value.trim();
                document.getElementById('step1').style.display = 'none';
                document.getElementById('step2').style.display = 'block';

            } catch (err) {
                alert(err.message);
            } finally {
                setLoading(signupText, signupSpinner, false);
            }
        });

        const otpForm      = document.getElementById('otpForm');
        const verifyText   = document.getElementById('verifyText');
        const verifySpinner= document.getElementById('verifySpinner');
        verifyText.dataset.original = verifyText.textContent;

        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoading(verifyText, verifySpinner, true, 'Verifying…');
            try {
                const token = await verifyOTP(pendingUserId, document.getElementById('otpInput').value.trim());
                localStorage.setItem('token', token);
                window.location.href = 'dashboard.html';
            } catch (err) {
                alert(err.message);
            } finally {
                setLoading(verifyText, verifySpinner, false);
            }
        });

        document.getElementById('resendBtn').addEventListener('click', () => resendOTP(pendingUserId));
    }

    // ── LOGIN ─────────────────────────────────────────────────────────────
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        let pendingUserId = null;

        const loginText    = document.getElementById('loginText');
        const loginSpinner = document.getElementById('loginSpinner');
        loginText.dataset.original = loginText.textContent;

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoading(loginText, loginSpinner, true, 'Checking…');
            try {
                const res  = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: document.getElementById('username').value.trim(),
                        password: document.getElementById('password').value
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Login failed');

                // Admin — direct token
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    window.location.href = 'dashboard.html';
                    return;
                }

                throw new Error('Unexpected response from server');

            } catch (err) {
                alert(err.message);
            } finally {
                setLoading(loginText, loginSpinner, false);
            }
        });

    }

});
