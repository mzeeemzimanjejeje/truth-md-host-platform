document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // DOM Elements
    const usernameDisplay = document.getElementById('usernameDisplay');
    const userRole = document.getElementById('userRole');
    const coinBalance = document.getElementById('coinBalance');
    const mobileCoinBalance = document.getElementById('mobileCoinBalance');
    const logoutBtn = document.getElementById('logoutBtn');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const navItems = document.querySelectorAll('.sidebar-nav li');
    const contentSections = document.querySelectorAll('.content-section');
    
    // Admin credentials
    const ADMIN_USERNAME = 'Courtney';
    const ADMIN_PASSWORD = 'Truth';
    
    // Initialize dashboard
    initDashboard();
    
    // Functions
    async function initDashboard() {
        // Set up event listeners immediately so nav always works
        setupEventListeners();

        try {
            // Get user data
            const user = await fetchUserData();
            
            // Display user info
            usernameDisplay.textContent = user.username;
            userRole.textContent = user.role === 'admin' ? 'Admin' : 'User';
            coinBalance.textContent = user.wallet.coins;
            mobileCoinBalance.textContent = user.wallet.coins;

            // Show admin nav item for admins
            if (user.role === 'admin') {
                const adminNavItem = document.getElementById('adminNavItem');
                if (adminNavItem) adminNavItem.style.display = 'flex';
            }
            
            // Load active/inactive bots count
            await loadDeploymentsCount();
            
            // Load wallet data
            await loadWalletData();
            
            // Load deployments
            await loadDeployments();
        } catch (err) {
            console.error('Dashboard init error:', err);
        }
    }
    
    async function fetchUserData() {
        const response = await fetch('/api/auth/user', {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }
        
        return await response.json();
    }
    
    async function loadDeploymentsCount() {
        const response = await fetch('/api/deployments/count', {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('activeBotsCount').textContent = data.active;
            document.getElementById('inactiveBotsCount').textContent = data.inactive;
            document.getElementById('dashboardCoins').textContent = data.coins;
        }
    }
    
    async function loadWalletData() {
        const response = await fetch('/api/wallet', {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update wallet display
            document.getElementById('walletCoins').textContent = data.coins;
            
            // Update referral info
            document.getElementById('referralLink').value = data.referralLink;
            document.getElementById('referralCount').textContent = data.referrals;
            document.getElementById('referralEarnings').textContent = data.referrals * 5;
            
            // Calculate next claim time
            if (data.lastClaim) {
                const lastClaim = new Date(data.lastClaim);
                const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
                const now = new Date();
                
                if (now < nextClaim) {
                    const hoursLeft = Math.ceil((nextClaim - now) / (60 * 60 * 1000));
                    document.getElementById('nextClaimTime').textContent = `${hoursLeft} hours`;
                } else {
                    document.getElementById('nextClaimTime').textContent = 'Now';
                }
            }
        }
    }
    
    async function loadDeployments() {
        const response = await fetch('/api/deployments', {
            headers: {
                'x-auth-token': token
            }
        });
        
        if (response.ok) {
            const deployments = await response.json();
            const deploymentsList = document.getElementById('deploymentsList');
            
            if (deployments.length === 0) {
                deploymentsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-rocket"></i>
                        <p>You don't have any deployments yet</p>
                        <button id="addFirstDeploymentBtn" class="btn btn-primary">
                            Create Your First Deployment
                        </button>
                    </div>
                `;
                
                document.getElementById('addFirstDeploymentBtn').addEventListener('click', () => {
                    document.getElementById('addDeploymentBtn').click();
                });
                
                return;
            }
            
            deploymentsList.innerHTML = '';
            
            deployments.forEach(deployment => {
                const isActive  = deployment.status === 'active';
                const framework = deployment.detectedFramework || 'Node.js Bot';
                const hasRepo   = !!deployment.repoUrl;
                const deploymentCard = document.createElement('div');
                deploymentCard.className = 'deployment-card glass-container';
                deploymentCard.dataset.id = deployment._id;
                deploymentCard.innerHTML = `
                    <div class="deployment-header">
                        <div>
                            <h3>${deployment.branchName}</h3>
                            <span class="framework-badge">${framework}</span>
                        </div>
                        <span class="status-badge ${deployment.status}" id="status-${deployment._id}">
                            <i class="fas fa-circle" style="font-size:0.55rem;margin-right:4px;"></i>${deployment.status}
                        </span>
                    </div>
                    <div class="deployment-details">
                        ${hasRepo ? `<p><i class="fab fa-github" style="width:16px;color:var(--accent)"></i> <a href="${deployment.repoUrl}" target="_blank" style="color:var(--accent);font-size:0.82rem;word-break:break-all;">${deployment.repoUrl.replace('https://github.com/', '')}</a></p>` : ''}
                        <p><i class="fas fa-user" style="width:14px;color:var(--accent)"></i> <strong>Owner:</strong> ${deployment.ownerNumber}</p>
                        <p><i class="fas fa-tag" style="width:14px;color:var(--accent)"></i> <strong>Prefix:</strong> ${deployment.prefix}</p>
                        <p><i class="fas fa-calendar" style="width:14px;color:var(--accent)"></i> <strong>Created:</strong> ${new Date(deployment.createdAt).toLocaleDateString()}</p>
                        <p style="font-size:0.75rem;color:var(--text-secondary);margin-top:6px;">
                            <i class="fas fa-server" style="width:14px;"></i> Truth MD Platform
                        </p>
                        <div class="uptime-row" id="uptime-${deployment._id}" style="${isActive && deployment.startedAt ? '' : 'display:none'}">
                            <i class="fas fa-clock" style="color:var(--accent);width:14px;font-size:0.8rem;"></i>
                            <span class="uptime-label">Running for:</span>
                            <span class="uptime-value" data-started="${deployment.startedAt || ''}">--</span>
                        </div>
                    </div>
                    <div class="bot-controls">
                        <button class="bot-ctrl-btn start-bot ${isActive ? 'disabled' : ''}" data-id="${deployment._id}" ${isActive ? 'disabled' : ''}>
                            <i class="fas fa-play"></i> Start
                        </button>
                        <button class="bot-ctrl-btn stop-bot ${!isActive ? 'disabled' : ''}" data-id="${deployment._id}" ${!isActive ? 'disabled' : ''}>
                            <i class="fas fa-stop"></i> Stop
                        </button>
                        <button class="bot-ctrl-btn restart-bot" data-id="${deployment._id}">
                            <i class="fas fa-redo"></i> Restart
                        </button>
                        <button class="bot-ctrl-btn logs-btn" data-id="${deployment._id}" data-name="${deployment.branchName}">
                            <i class="fas fa-terminal"></i> Logs
                        </button>
                        <button class="bot-ctrl-btn delete-btn" data-id="${deployment._id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `;
                deploymentsList.appendChild(deploymentCard);
            });

            // Bot control button listeners
            deploymentsList.querySelectorAll('.start-bot').forEach(btn => {
                btn.addEventListener('click', () => botAction(btn.dataset.id, 'start'));
            });
            deploymentsList.querySelectorAll('.stop-bot').forEach(btn => {
                btn.addEventListener('click', () => botAction(btn.dataset.id, 'stop'));
            });
            deploymentsList.querySelectorAll('.restart-bot').forEach(btn => {
                btn.addEventListener('click', () => botAction(btn.dataset.id, 'restart'));
            });
            deploymentsList.querySelectorAll('.logs-btn').forEach(btn => {
                btn.addEventListener('click', () => viewDeploymentLogs(btn.dataset.id, btn.dataset.name));
            });
            deploymentsList.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteDeployment(btn.dataset.id));
            });

            // Kick off live uptime ticker
            startUptimeTicker();

            // Real-time status polling (every 8s for bots with repos)
            startStatusPolling(deployments.filter(d => d.repoUrl).map(d => d._id));
        }
    }
    
    function setupEventListeners() {
        // Logout button
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        });
        
        // Mobile menu toggle
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        function openSidebar() {
            menuToggle.classList.add('active');
            sidebar.classList.add('active');
            sidebarOverlay.classList.add('active');
        }

        function closeSidebar() {
            menuToggle.classList.remove('active');
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        }

        menuToggle?.addEventListener('click', () => {
            sidebar.classList.contains('active') ? closeSidebar() : openSidebar();
        });

        sidebarOverlay?.addEventListener('click', closeSidebar);

        // Navigation items
        let adminInitialized = false;
        navItems.forEach(item => {
            if (item.id !== 'logoutBtn') {
                item.addEventListener('click', () => {
                    navItems.forEach(navItem => navItem.classList.remove('active'));
                    item.classList.add('active');
                    contentSections.forEach(section => section.classList.remove('active'));
                    const sectionId = `${item.getAttribute('data-section')}Section`;
                    document.getElementById(sectionId)?.classList.add('active');

                    // Init admin panel on first visit
                    if (item.getAttribute('data-section') === 'admin' && !adminInitialized) {
                        adminInitialized = true;
                        initAdminPanel();
                    }

                    if (window.innerWidth <= 992) closeSidebar();
                });
            }
        });
        
        // Quick action buttons
        document.getElementById('newDeploymentBtn')?.addEventListener('click', () => {
            document.getElementById('addDeploymentBtn').click();
        });
        
        document.getElementById('claimDailyBtn')?.addEventListener('click', () => {
            document.getElementById('claimDailyWalletBtn').click();
        });
        
        document.getElementById('viewReferralsBtn')?.addEventListener('click', () => {
            // Navigate to wallet section
            navItems.forEach(navItem => navItem.classList.remove('active'));
            document.querySelector('[data-section="wallet"]').classList.add('active');
            
            contentSections.forEach(section => section.classList.remove('active'));
            document.getElementById('walletSection').classList.add('active');
        });
        
        // Deployment modal
        const deploymentModal = document.getElementById('deploymentModal');
        const addDeploymentBtn = document.getElementById('addDeploymentBtn');
        const closeModal = document.querySelector('.close-modal');
        
        if (addDeploymentBtn) {
            addDeploymentBtn.addEventListener('click', () => {
                deploymentModal.style.display = 'block';
            });
        }
        
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                deploymentModal.style.display = 'none';
            });
        }
        
        window.addEventListener('click', (e) => {
            if (e.target === deploymentModal) {
                deploymentModal.style.display = 'none';
            }
        });
        
        // Deployment form
        const deploymentForm = document.getElementById('deploymentForm');
        if (deploymentForm) {
            deploymentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const branchName  = document.getElementById('deployBranchName').value;
                const repoUrl     = document.getElementById('deployRepoUrl').value.trim();
                const sessionId   = document.getElementById('deploySessionId').value;
                const ownerNumber = document.getElementById('deployOwnerNumber').value;
                const prefix      = document.getElementById('deployPrefix').value;
                
                const deployBtnText    = document.getElementById('deployBtnText');
                const deployBtnSpinner = document.getElementById('deployBtnSpinner');

                deployBtnText.innerHTML = repoUrl
                    ? '<i class="fas fa-code-branch"></i> Cloning repo…'
                    : '<i class="fas fa-rocket"></i> Deploying…';
                deployBtnSpinner.style.display = 'inline-block';
                
                try {

                    const response = await fetch('/api/deployments', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-auth-token': token
                        },
                        body: JSON.stringify({
                            branchName,
                            repoUrl: repoUrl || undefined,
                            sessionId,
                            ownerNumber,
                            prefix
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.msg || 'Deployment failed');
                    }
                    
                    // Close modal and refresh deployments
                    deploymentModal.style.display = 'none';
                    await loadDeployments();
                    await loadDeploymentsCount();
                    await loadWalletData();
                    
                    // Update coin balance display
                    const user = await fetchUserData();
                    coinBalance.textContent = user.wallet.coins;
                    mobileCoinBalance.textContent = user.wallet.coins;
                    
                    alert('Deployment created successfully!');
                } catch (err) {
                    alert(err.message);
                } finally {
                    deployBtnText.innerHTML = '<i class="fas fa-rocket"></i> Deploy Bot';
                    deployBtnSpinner.style.display = 'none';
                }
            });
        }
        
        // Claim daily coins
        const claimDailyBtn = document.getElementById('claimDailyWalletBtn');
        if (claimDailyBtn) {
            claimDailyBtn.addEventListener('click', async () => {
                claimDailyBtn.disabled = true;
                claimDailyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Claiming...';
                
                try {
                    const response = await fetch('/api/wallet/claim', {
                        method: 'POST',
                        headers: {
                            'x-auth-token': token
                        }
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.msg || 'Claim failed');
                    }
                    
                    // Update wallet display
                    document.getElementById('walletCoins').textContent = data.coins;
                    coinBalance.textContent = data.coins;
                    mobileCoinBalance.textContent = data.coins;
                    
                    // Update next claim time
                    const nextClaim = new Date(new Date(data.lastClaim).getTime() + 24 * 60 * 60 * 1000);
                    document.getElementById('nextClaimTime').textContent = '24 hours';
                    
                    alert('Successfully claimed 5 coins!');
                } catch (err) {
                    alert(err.message);
                } finally {
                    claimDailyBtn.disabled = false;
                    claimDailyBtn.innerHTML = '<i class="fas fa-gift"></i> Claim Daily (5 coins)';
                }
            });
        }
        
        // Copy referral link
        const copyReferralBtn = document.getElementById('copyReferralBtn');
        if (copyReferralBtn) {
            copyReferralBtn.addEventListener('click', () => {
                const referralLink = document.getElementById('referralLink');
                referralLink.select();
                document.execCommand('copy');
                
                // Show copied tooltip
                const tooltip = document.createElement('span');
                tooltip.className = 'tooltip';
                tooltip.textContent = 'Copied!';
                copyReferralBtn.appendChild(tooltip);
                
                setTimeout(() => {
                    tooltip.remove();
                }, 2000);
            });
        }
        
        // Change password form
        const changePasswordForm = document.getElementById('changePasswordForm');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const currentPassword = document.getElementById('currentPassword').value;
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                
                if (newPassword !== confirmPassword) {
                    alert('New passwords do not match');
                    return;
                }
                
                const submitBtn = changePasswordForm.querySelector('button');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                
                try {
                    const response = await fetch('/api/auth/change-password', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-auth-token': token
                        },
                        body: JSON.stringify({
                            currentPassword,
                            newPassword
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.msg || 'Password change failed');
                    }
                    
                    alert('Password changed successfully!');
                    changePasswordForm.reset();
                } catch (err) {
                    alert(err.message);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Update Password';
                }
            });
        }
        
        // Delete account button
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                    deleteAccountBtn.disabled = true;
                    deleteAccountBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
                    
                    try {
                        const response = await fetch('/api/auth/delete-account', {
                            method: 'DELETE',
                            headers: {
                                'x-auth-token': token
                            }
                        });
                        
                        const data = await response.json();
                        
                        if (!response.ok) {
                            throw new Error(data.msg || 'Account deletion failed');
                        }
                        
                        localStorage.removeItem('token');
                        window.location.href = 'login.html';
                    } catch (err) {
                        alert(err.message);
                        deleteAccountBtn.disabled = false;
                        deleteAccountBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Account';
                    }
                }
            });
        }
    }
    
    function setupBuyCoins() {
        const purchaseModal = document.getElementById('purchaseModal');
        const closePurchaseModal = document.querySelector('.close-purchase-modal');
        let selectedPackage = null;
        let pollInterval = null;

        function showStep(n) {
            [1, 2, 3, 4].forEach(i => {
                const el = document.getElementById(`purchaseStep${i}`);
                if (el) el.style.display = i === n ? '' : 'none';
            });
        }

        function stopPolling() {
            if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        }

        function openModal() {
            showStep(1);
            document.getElementById('buyerPhone').value = '';
            purchaseModal.style.display = 'block';
        }

        function closeModal() {
            stopPolling();
            purchaseModal.style.display = 'none';
        }

        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.package-card');
                selectedPackage = {
                    coins: card.getAttribute('data-coins'),
                    price: card.getAttribute('data-price'),
                    packageName: card.getAttribute('data-package')
                };
                document.getElementById('purchaseCoins').textContent = Number(selectedPackage.coins).toLocaleString() + ' coins';
                document.getElementById('purchasePrice').textContent = 'Ksh ' + Number(selectedPackage.price).toLocaleString();
                openModal();
            });
        });

        if (closePurchaseModal) {
            closePurchaseModal.addEventListener('click', closeModal);
        }

        window.addEventListener('click', (e) => {
            if (e.target === purchaseModal) closeModal();
        });

        document.getElementById('cancelPurchaseBtn')?.addEventListener('click', closeModal);

        document.getElementById('donePurchaseBtn')?.addEventListener('click', async () => {
            closeModal();
            await loadWalletData();
            const user = await fetchUserData();
            coinBalance.textContent = user.wallet.coins;
            mobileCoinBalance.textContent = user.wallet.coins;
            document.getElementById('dashboardCoins').textContent = user.wallet.coins;
        });

        document.getElementById('retryPurchaseBtn')?.addEventListener('click', () => showStep(1));

        const purchaseForm = document.getElementById('purchaseForm');
        if (purchaseForm) {
            purchaseForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!selectedPackage) return;

                const phone = document.getElementById('buyerPhone').value.trim();
                const submitText = document.getElementById('submitPurchaseText');
                const submitSpinner = document.getElementById('submitPurchaseSpinner');

                submitText.innerHTML = 'Sending...';
                submitSpinner.style.display = 'inline-block';

                try {
                    const response = await fetch('/api/wallet/stkpush', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                        body: JSON.stringify({
                            packageName: selectedPackage.packageName,
                            coins: selectedPackage.coins,
                            price: selectedPackage.price,
                            phone
                        })
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to send payment prompt');

                    document.getElementById('displayPhone').textContent = phone;
                    showStep(2);

                    const checkoutId = data.checkoutRequestId;
                    pollInterval = setInterval(async () => {
                        try {
                            const statusRes = await fetch(`/api/wallet/purchase-status/${checkoutId}`, {
                                headers: { 'x-auth-token': token }
                            });
                            if (!statusRes.ok) return;
                            const statusData = await statusRes.json();

                            if (statusData.status === 'completed') {
                                stopPolling();
                                document.getElementById('successCoins').textContent = Number(statusData.coins).toLocaleString();
                                document.getElementById('successReceipt').textContent = statusData.receipt || 'N/A';
                                showStep(3);
                            } else if (statusData.status === 'failed' || statusData.status === 'cancelled') {
                                stopPolling();
                                document.getElementById('failReason').textContent = statusData.resultDesc || 'Payment was not completed.';
                                showStep(4);
                            }
                        } catch (_) {}
                    }, 3000);

                    setTimeout(() => {
                        if (pollInterval) {
                            stopPolling();
                            document.getElementById('failReason').textContent = 'Payment timed out. Please try again.';
                            showStep(4);
                        }
                    }, 90000);

                } catch (err) {
                    alert(err.message);
                } finally {
                    submitText.innerHTML = '<i class="fas fa-mobile-alt"></i> Send STK Push';
                    submitSpinner.style.display = 'none';
                }
            });
        }
    }

    setupBuyCoins();

    // ── Notification Bell ──────────────────────────────────────────
    const notifDropdown   = document.getElementById('notifDropdown');
    const notifList       = document.getElementById('notifList');
    const notifEmpty      = document.getElementById('notifEmpty');
    const clearNotifsBtn  = document.getElementById('clearNotifsBtn');
    const notifBtnMobile  = document.getElementById('notifBtnMobile');
    const notifBtnDesktop = document.getElementById('notifBtnDesktop');
    const notifBadgeMobile  = document.getElementById('notifBadgeMobile');
    const notifBadgeDesktop = document.getElementById('notifBadgeDesktop');

    const SEEN_KEY = 'notif_seen_ids';

    function getSeenIds() {
        try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
    }
    function saveSeenIds(ids) {
        localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    }

    function timeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1)  return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    }

    function categoryIcon(category) {
        const map = {
            deployment: { cls: 'warning', icon: 'fa-rocket' },
            purchase:   { cls: 'success', icon: 'fa-shopping-cart' },
            daily:      { cls: 'coin',    icon: 'fa-gift' },
            referral:   { cls: 'info',    icon: 'fa-users' },
            other:      { cls: 'info',    icon: 'fa-info-circle' }
        };
        return map[category] || map.other;
    }

    function renderNotifications(notifications) {
        const seenIds = getSeenIds();
        const unread  = notifications.filter(n => !seenIds.includes(String(n.id)));

        notifList.innerHTML = '';

        if (notifications.length === 0) {
            notifEmpty.style.display = 'block';
            notifList.style.display  = 'none';
        } else {
            notifEmpty.style.display = 'none';
            notifList.style.display  = 'block';

            notifications.forEach(n => {
                const isUnread = !seenIds.includes(String(n.id));
                const { cls, icon } = categoryIcon(n.category);
                const sign  = n.type === 'earned' ? '+' : '-';
                const color = n.type === 'earned' ? 'var(--success)' : 'var(--error)';

                const li = document.createElement('li');
                li.className = `notif-item${isUnread ? ' unread' : ''}`;
                li.innerHTML = `
                    <div class="notif-icon ${cls}"><i class="fas ${icon}"></i></div>
                    <div class="notif-body">
                        <p>${n.description}</p>
                        <small>
                            <span style="color:${color};font-weight:700;">${sign}${n.amount} coins</span>
                            &nbsp;·&nbsp; ${timeAgo(n.createdAt)}
                        </small>
                    </div>`;
                notifList.appendChild(li);
            });
        }

        const count = unread.length;
        [notifBadgeMobile, notifBadgeDesktop].forEach(b => {
            if (!b) return;
            b.textContent = count > 9 ? '9+' : count;
            b.classList.toggle('visible', count > 0);
        });
        [notifBtnMobile, notifBtnDesktop].forEach(btn => {
            if (!btn) return;
            btn.classList.toggle('has-notif', count > 0);
        });
    }

    async function loadNotifications() {
        try {
            const res  = await fetch('/api/wallet/notifications', { headers: { 'x-auth-token': token } });
            if (!res.ok) return;
            const data = await res.json();
            renderNotifications(data.notifications || []);
        } catch (_) {}
    }

    function toggleDropdown() {
        const isOpen = notifDropdown.classList.toggle('open');
        if (isOpen) {
            fetch('/api/wallet/notifications', { headers: { 'x-auth-token': token } })
                .then(r => r.json())
                .then(data => {
                    const ids = (data.notifications || []).map(n => String(n.id));
                    saveSeenIds(ids);
                    renderNotifications(data.notifications || []);
                }).catch(() => {});
        }
    }

    function closeDropdown() { notifDropdown.classList.remove('open'); }

    notifBtnMobile?.addEventListener('click',  e => { e.stopPropagation(); toggleDropdown(); });
    notifBtnDesktop?.addEventListener('click', e => { e.stopPropagation(); toggleDropdown(); });

    clearNotifsBtn?.addEventListener('click', () => {
        fetch('/api/wallet/notifications', { headers: { 'x-auth-token': token } })
            .then(r => r.json())
            .then(data => {
                const ids = (data.notifications || []).map(n => String(n.id));
                saveSeenIds(ids);
                renderNotifications(data.notifications || []);
                closeDropdown();
            }).catch(() => {});
    });

    document.addEventListener('click', e => {
        if (notifDropdown && !notifDropdown.contains(e.target)) closeDropdown();
    });

    const sectionTitles = {
        dashboard: 'Dashboard', deployments: 'Deployments',
        wallet: 'Wallet', buyCoins: 'Buy Coins', settings: 'Settings'
    };
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const key = item.getAttribute('data-section');
            const titleEl = document.getElementById('topbarTitle');
            if (titleEl && sectionTitles[key]) titleEl.textContent = sectionTitles[key];
        });
    });

    loadNotifications();
    setInterval(loadNotifications, 60000);
    // ── End Notification Bell ──────────────────────────────────────

    // ── Uptime Ticker ───────────────────────────────────────────────
    let uptimeTicker = null;

    function formatUptime(ms) {
        if (ms < 0) ms = 0;
        const totalSec = Math.floor(ms / 1000);
        const d = Math.floor(totalSec / 86400);
        const h = Math.floor((totalSec % 86400) / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (d > 0) return `${d}d ${h}h ${m}m`;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function startUptimeTicker() {
        if (uptimeTicker) clearInterval(uptimeTicker);
        uptimeTicker = setInterval(() => {
            document.querySelectorAll('.uptime-value[data-started]').forEach(el => {
                const started = el.dataset.started;
                if (!started) return;
                const ms = Date.now() - new Date(started).getTime();
                el.textContent = formatUptime(ms);
            });
        }, 1000);
    }

    function setUptimeRow(id, startedAt) {
        const row = document.getElementById(`uptime-${id}`);
        if (!row) return;
        const el = row.querySelector('.uptime-value');
        if (startedAt) {
            if (el) el.dataset.started = startedAt;
            row.style.display = '';
        } else {
            row.style.display = 'none';
            if (el) { el.dataset.started = ''; el.textContent = '--'; }
        }
    }
    // ── End Uptime Ticker ───────────────────────────────────────────

    // ── Real-time Status Polling ────────────────────────────────────
    let statusPollTimer = null;

    function startStatusPolling(ids) {
        if (statusPollTimer) clearInterval(statusPollTimer);
        if (!ids || ids.length === 0) return;

        statusPollTimer = setInterval(async () => {
            for (const id of ids) {
                try {
                    const res  = await fetch(`/api/deployments/${id}/status`, { headers: { 'x-auth-token': token } });
                    if (!res.ok) continue;
                    const { status } = await res.json();
                    const badge    = document.getElementById(`status-${id}`);
                    const card     = document.querySelector(`.deployment-card[data-id="${id}"]`);
                    if (!badge || !card) continue;

                    const { status, startedAt } = await res.json();
                    const isActive = status === 'active';
                    badge.className  = `status-badge ${status}`;
                    badge.innerHTML  = `<i class="fas fa-circle" style="font-size:0.55rem;margin-right:4px;"></i>${status}`;

                    const startBtn = card.querySelector('.start-bot');
                    const stopBtn  = card.querySelector('.stop-bot');
                    if (startBtn) { startBtn.disabled = isActive;  startBtn.className = `bot-ctrl-btn start-bot${isActive ? ' disabled' : ''}`; }
                    if (stopBtn)  { stopBtn.disabled  = !isActive; stopBtn.className  = `bot-ctrl-btn stop-bot${!isActive ? ' disabled' : ''}`; }
                    setUptimeRow(id, isActive ? startedAt : null);
                } catch (_) {}
            }
        }, 8000);
    }
    // ── End Real-time Status Polling ────────────────────────────────

    // ── Bot Controls ────────────────────────────────────────────────
    async function botAction(id, action) {
        const card       = document.querySelector(`.deployment-card[data-id="${id}"]`);
        const statusBadge = document.getElementById(`status-${id}`);
        const startBtn   = card?.querySelector('.start-bot');
        const stopBtn    = card?.querySelector('.stop-bot');
        const btn        = card?.querySelector(`.${action}-bot`);

        if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i>`; }

        try {
            const res  = await fetch(`/api/deployments/${id}/${action}`, {
                method: 'PUT',
                headers: { 'x-auth-token': token }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.msg || `${action} failed`);

            const isActive = data.status === 'active';
            if (statusBadge) {
                statusBadge.className = `status-badge ${data.status}`;
                statusBadge.innerHTML = `<i class="fas fa-circle" style="font-size:0.55rem;margin-right:4px;"></i>${data.status}`;
            }
            if (startBtn) { startBtn.disabled = isActive;  startBtn.className = `bot-ctrl-btn start-bot${isActive ? ' disabled' : ''}`; }
            if (stopBtn)  { stopBtn.disabled  = !isActive; stopBtn.className  = `bot-ctrl-btn stop-bot${!isActive ? ' disabled' : ''}`; }

            // Update uptime row
            if (isActive) {
                setUptimeRow(id, new Date().toISOString());
            } else {
                setUptimeRow(id, null);
            }

            await loadDeploymentsCount();
        } catch (err) {
            alert(err.message);
        } finally {
            const actionIcon = { start: 'fa-play', stop: 'fa-stop', restart: 'fa-redo' };
            const actionLabel = { start: 'Start', stop: 'Stop', restart: 'Restart' };
            if (btn) {
                btn.disabled = action === 'start' ? (document.getElementById(`status-${id}`)?.textContent.trim() === 'active') : false;
                btn.innerHTML = `<i class="fas ${actionIcon[action]}"></i> ${actionLabel[action]}`;
            }
        }
    }

    // ── Logs Modal (Real-time) ──────────────────────────────────────
    const logsModal        = document.getElementById('logsModal');
    const logsContainer    = document.getElementById('logsContainer');
    const liveBadge        = document.getElementById('logsLiveBadge');
    const togglePollBtn    = document.getElementById('toggleLogsPollingBtn');
    const clearLogsViewBtn = document.getElementById('clearLogsViewBtn');

    let currentLogsId  = null;
    let logsPoller     = null;
    let logsPaused     = false;
    let lastLogKeys    = new Set();   // deduplicate across polls

    function levelColor(level) {
        return level === 'error' ? '#ff6b8a' : level === 'warn' ? '#ffd36b' : '#64ffda';
    }

    function renderLogs(logs) {
        if (logs.length === 0) {
            logsContainer.innerHTML = '<span style="color:#8892b0;">No logs yet. Start the bot to see output here.</span>';
            return;
        }
        // Remember scroll position (user may be scrolling)
        const atTop     = logsContainer.scrollTop < 40;
        const prevHTML  = logsContainer.innerHTML;

        const html = logs.map(l => {
            const time = new Date(l.timestamp).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour12: false });
            const date = new Date(l.timestamp).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' });
            return `<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.03);">` +
                `<span style="color:#495670;">[${date} ${time}]</span> ` +
                `<span style="color:${levelColor(l.level)};font-weight:600;">[${l.level.toUpperCase()}]</span> ` +
                `<span style="color:#ccd6f6;">${escapeHtml(l.message)}</span>` +
                `</div>`;
        }).join('');

        if (html !== prevHTML) {
            logsContainer.innerHTML = html;
            if (atTop) logsContainer.scrollTop = 0;
        }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    async function fetchAndRenderLogs(id) {
        try {
            const res  = await fetch(`/api/deployments/${id}/logs`, { headers: { 'x-auth-token': token } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.msg || 'Failed to load logs');
            renderLogs(data.logs || []);
        } catch (err) {
            logsContainer.innerHTML = `<span style="color:#ff6b8a;"><i class="fas fa-exclamation-circle"></i> ${err.message}</span>`;
        }
    }

    function startLogsPolling(id) {
        stopLogsPolling();
        logsPaused = false;
        setBadgeLive(true);
        logsPoller = setInterval(async () => {
            if (!logsPaused && currentLogsId) await fetchAndRenderLogs(currentLogsId);
        }, 2500);
    }

    function stopLogsPolling() {
        if (logsPoller) { clearInterval(logsPoller); logsPoller = null; }
        setBadgeLive(false);
    }

    function setBadgeLive(live) {
        if (!liveBadge) return;
        liveBadge.style.opacity = live && !logsPaused ? '1' : '0.35';
    }

    async function viewDeploymentLogs(deploymentId, name) {
        currentLogsId = deploymentId;
        logsPaused    = false;
        document.getElementById('logsModalName').textContent = name || deploymentId;
        if (togglePollBtn) togglePollBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        logsContainer.innerHTML = '<span style="color:var(--accent);"><i class="fas fa-circle-notch fa-spin"></i> Connecting…</span>';
        logsModal.style.display = 'block';
        await fetchAndRenderLogs(deploymentId);
        startLogsPolling(deploymentId);
    }

    function closeLogs() {
        stopLogsPolling();
        logsModal.style.display = 'none';
        currentLogsId = null;
        logsPaused    = false;
    }

    document.querySelector('.close-logs-modal')?.addEventListener('click', closeLogs);

    window.addEventListener('click', e => { if (e.target === logsModal) closeLogs(); });

    togglePollBtn?.addEventListener('click', () => {
        logsPaused = !logsPaused;
        togglePollBtn.innerHTML = logsPaused
            ? '<i class="fas fa-play"></i> Resume'
            : '<i class="fas fa-pause"></i> Pause';
        setBadgeLive(!logsPaused);
    });

    clearLogsViewBtn?.addEventListener('click', () => {
        logsContainer.innerHTML = '<span style="color:#8892b0;">View cleared. New logs will appear shortly…</span>';
    });
    // ── End Logs Modal ──────────────────────────────────────────────

    // ── End Bot Controls ────────────────────────────────────────────

    // ── Admin Panel ─────────────────────────────────────────────────
    async function initAdminPanel() {
        // Load stats
        try {
            const res = await fetch('/api/admin/stats', { headers: { 'x-auth-token': token } });
            if (res.ok) {
                const s = await res.json();
                document.getElementById('adminTotalUsers').textContent        = s.totalUsers;
                document.getElementById('adminTotalDeployments').textContent  = s.totalDeployments;
                document.getElementById('adminPendingPurchases').textContent  = s.pendingPurchases;
                document.getElementById('adminCompletedPurchases').textContent = s.completedPurchases;
            }
        } catch (e) { console.error('Admin stats error:', e); }

        // Tab switching
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');

                if (tab.dataset.tab === 'adminUsers')       loadAdminUsers();
                if (tab.dataset.tab === 'adminPurchases')   loadAdminPurchases();
                if (tab.dataset.tab === 'adminDeployments') loadAdminDeployments();
            });
        });

        // Default: load users
        await loadAdminUsers();
    }

    async function loadAdminUsers() {
        const tbody = document.getElementById('adminUsersBody');
        tbody.innerHTML = '<tr><td colspan="5" class="admin-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</td></tr>';
        try {
            const res = await fetch('/api/admin/users', { headers: { 'x-auth-token': token } });
            const users = await res.json();
            if (!users.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="admin-loading">No users found.</td></tr>';
                return;
            }
            tbody.innerHTML = users.map(u => `
                <tr>
                    <td><strong>${u.username}</strong></td>
                    <td><span class="admin-badge ${u.role}">${u.role}</span></td>
                    <td><i class="fas fa-coins" style="color:var(--accent);margin-right:5px;"></i>${u.wallet?.coins ?? 0}</td>
                    <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="admin-actions">
                            <button class="admin-btn add-coins" data-id="${u._id}" data-name="${u.username}">
                                <i class="fas fa-plus"></i> Add Coins
                            </button>
                            ${u.role !== 'admin' ? `<button class="admin-btn delete" data-id="${u._id}" data-type="user">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');

            tbody.querySelectorAll('.add-coins').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const amount = prompt(`Add coins to ${btn.dataset.name}:\nEnter a number (positive to add, negative to deduct):`);
                    if (!amount || isNaN(amount)) return;
                    const res = await fetch(`/api/admin/users/${btn.dataset.id}/coins`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                        body: JSON.stringify({ coins: parseInt(amount) })
                    });
                    const data = await res.json();
                    if (res.ok) { alert(`Done! ${btn.dataset.name} now has ${data.coins} coins.`); loadAdminUsers(); }
                    else alert(data.error || 'Failed');
                });
            });

            tbody.querySelectorAll('.delete[data-type="user"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Delete this user and all their deployments? This cannot be undone.')) return;
                    const res = await fetch(`/api/admin/users/${btn.dataset.id}`, {
                        method: 'DELETE', headers: { 'x-auth-token': token }
                    });
                    if (res.ok) { alert('User deleted.'); loadAdminUsers(); }
                    else alert('Failed to delete user.');
                });
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="admin-loading">Error loading users.</td></tr>`;
        }
    }

    async function loadAdminPurchases() {
        const tbody = document.getElementById('adminPurchasesBody');
        tbody.innerHTML = '<tr><td colspan="7" class="admin-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</td></tr>';
        try {
            const res = await fetch('/api/admin/purchases', { headers: { 'x-auth-token': token } });
            const purchases = await res.json();
            if (!purchases.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">No purchases found.</td></tr>';
                return;
            }
            tbody.innerHTML = purchases.map(p => `
                <tr>
                    <td><strong>${p.user?.username ?? '—'}</strong></td>
                    <td>${p.packageName}</td>
                    <td><i class="fas fa-coins" style="color:var(--accent);margin-right:4px;"></i>${p.coins}</td>
                    <td>Ksh ${p.price}</td>
                    <td><span class="admin-badge ${p.status}">${p.status}</span></td>
                    <td>${new Date(p.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="admin-actions">
                            ${p.status === 'pending' ? `
                                <button class="admin-btn approve" data-id="${p._id}"><i class="fas fa-check"></i> Approve</button>
                                <button class="admin-btn reject"  data-id="${p._id}"><i class="fas fa-times"></i> Reject</button>
                            ` : '—'}
                        </div>
                    </td>
                </tr>
            `).join('');

            tbody.querySelectorAll('.approve').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Approve this purchase and credit coins to the user?')) return;
                    const res = await fetch(`/api/admin/purchases/${btn.dataset.id}/approve`, {
                        method: 'PATCH', headers: { 'x-auth-token': token }
                    });
                    const data = await res.json();
                    if (res.ok) { alert('Purchase approved and coins credited!'); loadAdminPurchases(); initAdminStats(); }
                    else alert(data.error || 'Failed');
                });
            });

            tbody.querySelectorAll('.reject').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Reject this purchase?')) return;
                    const res = await fetch(`/api/admin/purchases/${btn.dataset.id}/reject`, {
                        method: 'PATCH', headers: { 'x-auth-token': token }
                    });
                    const data = await res.json();
                    if (res.ok) { alert('Purchase rejected.'); loadAdminPurchases(); }
                    else alert(data.error || 'Failed');
                });
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" class="admin-loading">Error loading purchases.</td></tr>`;
        }
    }

    async function loadAdminDeployments() {
        const tbody = document.getElementById('adminDeploymentsBody');
        tbody.innerHTML = '<tr><td colspan="5" class="admin-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading…</td></tr>';
        try {
            const res = await fetch('/api/admin/deployments', { headers: { 'x-auth-token': token } });
            const deps = await res.json();
            if (!deps.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="admin-loading">No deployments found.</td></tr>';
                return;
            }
            tbody.innerHTML = deps.map(d => `
                <tr>
                    <td><strong>${d.branchName}</strong></td>
                    <td>${d.user?.username ?? '—'}</td>
                    <td><span class="admin-badge ${d.status}">${d.status}</span></td>
                    <td>${new Date(d.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="admin-actions">
                            <button class="admin-btn delete" data-id="${d._id}" data-type="deployment">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            tbody.querySelectorAll('.delete[data-type="deployment"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Delete this deployment?')) return;
                    const res = await fetch(`/api/admin/deployments/${btn.dataset.id}`, {
                        method: 'DELETE', headers: { 'x-auth-token': token }
                    });
                    if (res.ok) { alert('Deployment deleted.'); loadAdminDeployments(); }
                    else alert('Failed to delete.');
                });
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="admin-loading">Error loading deployments.</td></tr>`;
        }
    }

    async function initAdminStats() {
        try {
            const res = await fetch('/api/admin/stats', { headers: { 'x-auth-token': token } });
            if (res.ok) {
                const s = await res.json();
                document.getElementById('adminTotalUsers').textContent         = s.totalUsers;
                document.getElementById('adminTotalDeployments').textContent   = s.totalDeployments;
                document.getElementById('adminPendingPurchases').textContent   = s.pendingPurchases;
                document.getElementById('adminCompletedPurchases').textContent = s.completedPurchases;
            }
        } catch (e) {}
    }
    // ── End Admin Panel ──────────────────────────────────────────────

    async function deleteDeployment(deploymentId) {
        if (confirm('Are you sure you want to delete this deployment?')) {
            try {
                const response = await fetch(`/api/deployments/${deploymentId}`, {
                    method: 'DELETE',
                    headers: {
                        'x-auth-token': token
                    }
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.msg || 'Deletion failed');
                }
                
                // Refresh deployments list
                await loadDeployments();
                await loadDeploymentsCount();
                
                alert('Deployment deleted successfully');
            } catch (err) {
                alert(err.message);
            }
        }
    }
});
