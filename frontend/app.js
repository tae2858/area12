import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction, push, set, serverTimestamp, query, limitToLast, get, child } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyDzM4EG7aqCSW3QuAYKBJw0_gZeo1UedbI",
  authDomain: "link-mtc.firebaseapp.com",
  databaseURL: "https://link-mtc-default-rtdb.firebaseio.com",
  projectId: "link-mtc",
  storageBucket: "link-mtc.firebasestorage.app",
  messagingSenderId: "1069066043873",
  appId: "1:1069066043873:web:d8ad0d0a0ef9be239f12a0",
  measurementId: "G-6F0WDLXP26"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

let allServers = [];

// Typewriter taglines for Guns.lol overlay effect
const TAGLINES = [
    "Scraping the MultiCraft network...",
    "Live server indicators & caps.",
    "Click anywhere to copy tokens.",
    "Real-time multiplayer lobbies.",
    "Powered by Area 12."
];

// Load YouTube IFrame Player API dynamically
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player = null;
window.onYouTubeIframeAPIReady = function() {
    player = new YT.Player('yt-player', {
        events: {
            'onReady': () => {
                const volumeSlider = document.getElementById("volume-slider");
                if (volumeSlider && player && typeof player.setVolume === 'function') {
                    player.setVolume(volumeSlider.value * 100);
                }
            }
        }
    });
};

// 1. Entry Overlay & Music Controller
document.addEventListener("DOMContentLoaded", () => {
    const enterBtn = document.getElementById("enter-btn");
    const enterOverlay = document.getElementById("enter-overlay");
    const playPauseBtn = document.getElementById("player-play-pause");
    const volumeSlider = document.getElementById("volume-slider");
    const visualizer = document.querySelector(".visualizer");

    let isPlaying = false;

    // Typewriter effect trigger
    startTypewriter();

    // Register back button for Guns.lol server profile routing
    document.getElementById("bio-back-btn").addEventListener("click", () => {
        window.history.pushState({}, '', '/');
        checkRoute(allServers);
    });

    enterBtn.addEventListener("click", () => {
        // Hide entry overlay
        enterOverlay.classList.add("hide");
        
        // Start background YouTube music stream via Player API
        isPlaying = true;
        if (player && typeof player.playVideo === 'function') {
            player.playVideo();
            if (typeof player.setVolume === 'function') {
                player.setVolume(volumeSlider.value * 100);
            }
        } else {
            // Fallback retry if YouTube SDK takes longer to load
            setTimeout(() => {
                if (player && typeof player.playVideo === 'function') {
                    player.playVideo();
                    if (typeof player.setVolume === 'function') {
                        player.setVolume(volumeSlider.value * 100);
                    }
                }
            }, 800);
        }

        document.getElementById("music-player-widget").style.transform = "translateX(0)";
        toggleVisualizer(true);
    });

    // Initialize Realtime Database Sync
    initRealtimeDatabaseSync();

    // Initialize Firebase Auth
    initFirebaseAuth();

    // Initialize Global Chat
    initGlobalChat();

    // Initialize Reviews
    initReviews();

    // Setup credits link navigation
    const creditsLink = document.getElementById("credits-link");
    if (creditsLink) {
        creditsLink.addEventListener("click", (e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/credits');
            checkRoute(allServers);
        });
    }

    // Credits back button listener
    const creditsBackBtn = document.getElementById("credits-back-btn");
    if (creditsBackBtn) {
        creditsBackBtn.addEventListener("click", () => {
            window.history.pushState({}, '', '/');
            checkRoute(allServers);
        });
    }

    // Play/Pause Button handler
    playPauseBtn.addEventListener("click", () => {
        if (!isPlaying) {
            if (player && typeof player.playVideo === 'function') {
                player.playVideo();
            }
            playPauseBtn.innerText = "⏸";
            document.querySelector(".song-status").innerText = "PLAYING";
            toggleVisualizer(true);
            isPlaying = true;
        } else {
            if (player && typeof player.pauseVideo === 'function') {
                player.pauseVideo();
            }
            playPauseBtn.innerText = "▶";
            document.querySelector(".song-status").innerText = "PAUSED";
            toggleVisualizer(false);
            isPlaying = false;
        }
    });

    // Volume Slider handler
    volumeSlider.addEventListener("input", (e) => {
        const volumeVal = Math.floor(e.target.value * 100);
        if (player && typeof player.setVolume === 'function') {
            player.setVolume(volumeVal);
        }
    });

    function toggleVisualizer(play) {
        const bars = visualizer.querySelectorAll(".bar");
        bars.forEach(bar => {
            bar.style.animationPlayState = play ? "running" : "paused";
        });
    }
});

// 2. Typewriter Effect
function startTypewriter() {
    const element = document.getElementById("typewriter");
    let lineIdx = 0;
    let charIdx = 0;
    let isDeleting = false;

    function tick() {
        const currentLine = TAGLINES[lineIdx];
        if (isDeleting) {
            element.innerText = currentLine.substring(0, charIdx - 1);
            charIdx--;
        } else {
            element.innerText = currentLine.substring(0, charIdx + 1);
            charIdx++;
        }

        let delay = 100;
        if (!isDeleting && charIdx === currentLine.length) {
            delay = 2000; // Pause at end of text
            isDeleting = true;
        } else if (isDeleting && charIdx === 0) {
            isDeleting = false;
            lineIdx = (lineIdx + 1) % TAGLINES.length;
            delay = 500;
        }

        setTimeout(tick, delay);
    }
    tick();
}



// 4. API Fetching & Render Dashboard Loop
// 4. Real-time Firebase Database Synchronizer
function initRealtimeDatabaseSync() {
    const serversRef = ref(db, 'servers');
    onValue(serversRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allServers = data;
            renderPinnedFavorites(allServers);
            renderDirectoryGrid(allServers);
            checkRoute(allServers); // Evaluate routing on new data
        } else {
            document.getElementById("lobby-counter").innerText = "Waiting for background server engine synchronizer...";
        }
    }, (error) => {
        console.error("Firebase sync error: ", error);
        document.getElementById("lobby-counter").innerText = "Database connection offline. Re-evaluating...";
    });
}


// 6. Render Pinned Favorites (Subscription-style Cards)
function renderPinnedFavorites(servers) {
    const favorites = servers.filter(s => s.is_favorite === true);
    const container = document.getElementById("favorites-grid");
    container.innerHTML = "";

    if (favorites.length === 0) {
        container.innerHTML = `<div class="no-results">No pinned slots active</div>`;
        return;
    }

    favorites.forEach(server => {
        const card = document.createElement("div");
        card.className = "slot-card slot-favorite";
        card.innerHTML = `
            <div>
                <span class="slot-badge-top">⭐ FAVORITE</span>
                <div class="slot-card-header">
                    <h4 class="slot-title">${server.name}</h4>
                    <div class="slot-status-bar">
                        <span class="status-dot ${server.online ? 'online' : 'offline'}"></span>
                        <span>${server.online ? 'ONLINE' : 'OFFLINE'}</span>
                    </div>
                </div>
                <div class="slot-stats-panel">
                    <div class="slot-stat-row">
                        <span class="slot-stat-label">Invite code</span>
                        <span class="slot-stat-value"><code>${server.server_id}</code></span>
                    </div>
                    <div class="slot-stat-row">
                        <span class="slot-stat-label">PLAYERS</span>
                        <span class="slot-stat-value">${server.players}</span>
                    </div>
                    <div class="slot-stat-row">
                        <span class="slot-stat-label">BATTLE</span>
                        <span class="slot-stat-value">${server.pvp ? '⚔️ PvP' : '🌾 Safe'}</span>
                    </div>
                </div>
                <p class="slot-desc">${server.description}</p>
            </div>
            <button class="slot-btn" onclick="copyToClipboard('${server.server_id}')">COPY CODE</button>
        `;
        container.appendChild(card);
    });
}

// 7. Render All Active Servers (Searchable Grid)
function renderDirectoryGrid(servers) {
    const searchVal = document.getElementById("search-input").value.toLowerCase();
    const container = document.getElementById("server-grid");
    container.innerHTML = "";

    // Exclude favorites already displayed in upper slots to prevent redundancy
    const filtered = servers.filter(s => {
        const matchSearch = s.name.toLowerCase().includes(searchVal) || s.server_id.toLowerCase().includes(searchVal);
        return matchSearch;
    });

    document.getElementById("lobby-counter").innerText = `Showing ${filtered.length} Live Network Rooms`;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="no-results" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary)">No lobbies matching "${searchVal}" found</div>`;
        return;
    }

    filtered.forEach(server => {
        // Calculate player capacity percentage for progress bars
        let pct = 0;
        try {
            const parts = server.players.split("/");
            if (parts.length === 2 && parseInt(parts[1]) > 0) {
                pct = (parseInt(parts[0]) / parseInt(parts[1])) * 100;
            }
        } catch(e){}

        const card = document.createElement("div");
        card.className = "server-card";
        card.innerHTML = `
            <div>
                <div class="server-header">
                    <h4 class="server-name">${server.name}</h4>
                    <span class="status-badge ${server.online ? 'online' : 'offline'}">${server.online ? 'online' : 'offline'}</span>
                </div>
                <div class="server-details">
                    <div class="detail-line">
                        <span class="detail-lbl">Invite code</span>
                        <span class="detail-val token">${server.server_id}</span>
                    </div>
                    <div class="detail-line">
                        <span class="detail-lbl">Maker</span>
                        <span class="detail-val">${server.admin}</span>
                    </div>
                    <div class="detail-line">
                        <span class="detail-lbl">Players (${server.players})</span>
                        <span class="detail-val">${server.pvp ? '⚔️ PvP' : '🌾 PvE'}</span>
                    </div>
                    <div class="player-progress-container">
                        <div class="player-progress-bar" style="width: ${pct}%"></div>
                    </div>
                </div>
                <p class="server-description-box">${server.description}</p>
            </div>
            <button class="copy-card-btn" onclick="copyToClipboard('${server.server_id}')">COPY CODE</button>
        `;
        container.appendChild(card);
    });
}

// 8. Dynamic Search Input Key Listener
document.getElementById("search-input").addEventListener("input", () => {
    renderDirectoryGrid(allServers);
});

// 9. Clipboard Copy Utility with Toast triggers
window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`Invite code "${text}" copied! Paste into MultiCraft. 🎮`);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// 10. Guns.lol Profile Routing System
function checkRoute(servers) {
    const rawPath = window.location.pathname.replace(/^\/|\/$/g, '').trim();
    if (!rawPath || rawPath.toLowerCase() === "index.html" || rawPath.toLowerCase() === "index") {
        document.getElementById("bio-page-container").classList.add("hidden");
        document.getElementById("credits-page-container").classList.add("hidden");
        document.querySelector(".main-navbar").classList.remove("hidden");
        document.querySelector(".content-container").classList.remove("hidden");
        return;
    }

    const path = rawPath.toLowerCase();

    if (path === "credits") {
        document.getElementById("credits-page-container").classList.remove("hidden");
        document.getElementById("bio-page-container").classList.add("hidden");
        document.querySelector(".main-navbar").classList.add("hidden");
        document.querySelector(".content-container").classList.add("hidden");
        document.getElementById("enter-overlay").classList.add("hide");
        document.getElementById("music-player-widget").style.transform = "translateX(0)";
        return;
    }
    
    // Locate server matching ID or sanitized title (alphanumeric only)
    const matched = servers.find(s => {
        const sId = s.server_id.toLowerCase();
        const sNameSanitized = s.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const pathSanitized = path.replace(/[^a-zA-Z0-9]/g, '');
        return sId === path || sNameSanitized === pathSanitized;
    });

    if (matched) {
        // Swap UI panels
        document.getElementById("bio-page-container").classList.remove("hidden");
        document.querySelector(".main-navbar").classList.add("hidden");
        document.querySelector(".content-container").classList.add("hidden");
        document.getElementById("enter-overlay").classList.add("hide"); // Hide entry dialog

        // Fill bio card elements
        document.getElementById("bio-server-name").innerText = matched.name.toUpperCase();
        document.getElementById("bio-maker").innerText = matched.admin;
        document.getElementById("bio-players").innerText = matched.players;
        document.getElementById("bio-pvp").innerText = matched.pvp ? "⚔️ PvP Enabled" : "🌾 Safe Zone";
        document.getElementById("bio-invite-code").innerText = matched.server_id;

        // Auto trigger background player visible indicator
        document.getElementById("music-player-widget").style.transform = "translateX(0)";

        // Start typing tagline
        startBioTypewriter(matched.description);

        // 9. Setup stats references in Firebase RTDB
        const serverId = matched.server_id;
        const statsViewsRef = ref(db, `stats/${serverId}/views`);
        const statsLikesRef = ref(db, `stats/${serverId}/likes`);

        // Increment view count transaction (only once per route load)
        if (window.currentRouteId !== serverId) {
            window.currentRouteId = serverId;
            runTransaction(statsViewsRef, (currentViews) => {
                return (currentViews || 0) + 1;
            });
        }
        loadReviews(serverId);

        // Setup real-time listeners for views and likes counts
        onValue(statsViewsRef, (snapshot) => {
            document.getElementById("bio-views-count").innerText = (snapshot.val() || 0).toLocaleString();
        });

        onValue(statsLikesRef, (snapshot) => {
            document.getElementById("bio-likes-count").innerText = (snapshot.val() || 0).toLocaleString();
        });

        // Like button handler (1 like per device using localStorage)
        const bioLikeBtn = document.getElementById("bio-like-btn");
        bioLikeBtn.onclick = () => {
            const likeKey = `area12_liked_${serverId}`;
            if (localStorage.getItem(likeKey)) {
                showToast("You've already liked this server!");
                return;
            }
            
            runTransaction(statsLikesRef, (currentLikes) => {
                return (currentLikes || 0) + 1;
            }).then((result) => {
                if (result.committed) {
                    localStorage.setItem(likeKey, "true");
                    showToast("Server liked successfully! 👍");
                }
            }).catch(err => {
                console.error("Like error: ", err);
            });
        };

        // Bind copy triggers
        const copyBtn = document.getElementById("bio-copy-btn");
        const codeBox = document.getElementById("bio-invite-code");
        const copyAction = () => {
            copyToClipboard(matched.server_id);
        };
        copyBtn.replaceWith(copyBtn.cloneNode(true));
        codeBox.replaceWith(codeBox.cloneNode(true));
        document.getElementById("bio-copy-btn").addEventListener("click", copyAction);
        document.getElementById("bio-invite-code").addEventListener("click", copyAction);
    } else {
        // Safe redirect to main page index if path not found
        window.history.replaceState({}, '', '/');
        document.getElementById("bio-page-container").classList.add("hidden");
        document.getElementById("credits-page-container").classList.add("hidden");
        document.querySelector(".main-navbar").classList.remove("hidden");
        document.querySelector(".content-container").classList.remove("hidden");
        if (window.unsubscribeReviews) {
            window.unsubscribeReviews();
            window.unsubscribeReviews = null;
        }
        window.currentRouteId = null;
    }
}

let bioTypewriterTimer = null;
function startBioTypewriter(text) {
    if (bioTypewriterTimer) clearTimeout(bioTypewriterTimer);
    const element = document.getElementById("bio-typewriter");
    element.innerText = "";
    let charIdx = 0;
    function tick() {
        element.innerText = text.substring(0, charIdx + 1);
        charIdx++;
        if (charIdx < text.length) {
            bioTypewriterTimer = setTimeout(tick, 40);
        }
    }
    tick();
}

// 11. Firebase Authentication Controller
function initFirebaseAuth() {
    const loginModal = document.getElementById("login-modal");
    const loginForm = document.getElementById("login-form");
    const signinNavBtn = document.getElementById("signin-nav-btn");
    const loginCloseBtn = document.getElementById("login-close-btn");
    const loginToggleBtn = document.getElementById("login-toggle-btn");
    const loginToggleText = document.getElementById("login-toggle-text");
    const loginModalTitle = document.getElementById("login-modal-title");
    const loginSubmitBtn = document.getElementById("login-submit-btn");
    const errorMsgDiv = document.getElementById("login-error-msg");

    const usernameInputGroup = document.getElementById("username-input-group");
    const usernameInput = document.getElementById("login-username");
    const emailLabel = document.getElementById("email-label");
    const loginEmailInput = document.getElementById("login-email");
    const forgotPasswordLink = document.getElementById("forgot-password-link");

    const loginFormContainer = document.getElementById("login-form-container");
    const resetFormContainer = document.getElementById("reset-form-container");
    const resetPasswordForm = document.getElementById("reset-password-form");
    const resetEmailInput = document.getElementById("reset-email");
    const resetErrorMsg = document.getElementById("reset-error-msg");
    const resetBackBtn = document.getElementById("reset-back-btn");

    let isSignUpMode = false;

    // Toggle modal visibility
    const showModal = () => {
        errorMsgDiv.classList.add("hidden");
        loginForm.reset();
        
        // Reset to sign in mode first
        isSignUpMode = false;
        loginModalTitle.innerText = "SIGN IN";
        document.querySelector(".login-subtitle").innerText = "Access your Area 12 account";
        loginSubmitBtn.innerText = "SIGN IN";
        loginToggleText.innerText = "Don't have an account?";
        loginToggleBtn.innerText = "Sign Up";
        usernameInputGroup.classList.add("hidden");
        usernameInput.required = false;
        emailLabel.innerText = "EMAIL ADDRESS OR USERNAME";
        loginEmailInput.placeholder = "name@domain.com or username";
        
        // Hide reset password view
        loginFormContainer.classList.remove("hidden");
        resetFormContainer.classList.add("hidden");
        
        loginModal.classList.remove("hidden");
    };

    const hideModal = () => {
        loginModal.classList.add("hidden");
    };

    signinNavBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (user) {
            signOut(auth).then(() => {
                showToast("Logged out successfully.");
            }).catch(err => {
                console.error("Sign out error: ", err);
            });
        } else {
            showModal();
        }
    });

    loginCloseBtn.addEventListener("click", hideModal);
    document.querySelector(".login-modal-overlay").addEventListener("click", hideModal);

    // Switch between Register/Login modes
    loginToggleBtn.addEventListener("click", () => {
        isSignUpMode = !isSignUpMode;
        errorMsgDiv.classList.add("hidden");
        loginForm.reset();
        
        if (isSignUpMode) {
            loginModalTitle.innerText = "SIGN UP";
            document.querySelector(".login-subtitle").innerText = "Create your Area 12 account";
            loginSubmitBtn.innerText = "SIGN UP";
            loginToggleText.innerText = "Already have an account?";
            loginToggleBtn.innerText = "Sign In";
            usernameInputGroup.classList.remove("hidden");
            usernameInput.required = true;
            emailLabel.innerText = "EMAIL ADDRESS";
            loginEmailInput.placeholder = "name@domain.com";
        } else {
            loginModalTitle.innerText = "SIGN IN";
            document.querySelector(".login-subtitle").innerText = "Access your Area 12 account";
            loginSubmitBtn.innerText = "SIGN IN";
            loginToggleText.innerText = "Don't have an account?";
            loginToggleBtn.innerText = "Sign Up";
            usernameInputGroup.classList.add("hidden");
            usernameInput.required = false;
            emailLabel.innerText = "EMAIL ADDRESS OR USERNAME";
            loginEmailInput.placeholder = "name@domain.com or username";
        }
    });

    // Toggle forgot password form view
    forgotPasswordLink.addEventListener("click", () => {
        loginFormContainer.classList.add("hidden");
        resetFormContainer.classList.remove("hidden");
        resetPasswordForm.reset();
        resetErrorMsg.classList.add("hidden");
    });

    resetBackBtn.addEventListener("click", () => {
        resetFormContainer.classList.add("hidden");
        loginFormContainer.classList.remove("hidden");
    });

    // Handle password reset
    resetPasswordForm.addEventListener("submit", (e) => {
        e.preventDefault();
        resetErrorMsg.classList.add("hidden");
        const resetVal = resetEmailInput.value.trim();
        if (!resetVal) return;

        let emailPromise;
        if (!resetVal.includes("@")) {
            // Treat as username
            const usernameLower = resetVal.toLowerCase();
            emailPromise = get(ref(db, "usernames/" + usernameLower)).then(snap => {
                if (!snap.exists()) {
                    throw new Error("Username not found.");
                }
                return snap.val().email;
            });
        } else {
            emailPromise = Promise.resolve(resetVal);
        }

        emailPromise.then(email => {
            return sendPasswordResetEmail(auth, email);
        }).then(() => {
            showToast("Password reset link sent to your email!");
            resetFormContainer.classList.add("hidden");
            loginFormContainer.classList.remove("hidden");
        }).catch(err => {
            resetErrorMsg.innerText = err.message.replace("Firebase: ", "");
            resetErrorMsg.classList.remove("hidden");
        });
    });

    // Handle authentication submissions
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        errorMsgDiv.classList.add("hidden");
        
        const identifier = loginEmailInput.value.trim();
        const password = document.getElementById("login-password").value;

        if (isSignUpMode) {
            const username = usernameInput.value.trim();
            const usernameLower = username.toLowerCase();

            // Validate username formatting (alphanumeric and underscores, 3-15 chars)
            const usernameRegex = /^[a-zA-Z0-9_]{3,15}$/;
            if (!usernameRegex.test(username)) {
                errorMsgDiv.innerText = "Username must be 3-15 characters and contain only letters, numbers, or underscores.";
                errorMsgDiv.classList.remove("hidden");
                return;
            }

            // Check username uniqueness
            get(ref(db, "usernames/" + usernameLower)).then((snapshot) => {
                if (snapshot.exists()) {
                    throw new Error("This username is already taken.");
                }
                return createUserWithEmailAndPassword(auth, identifier, password);
            })
            .then((userCredential) => {
                const user = userCredential.user;
                // Update profile display name with username
                return updateProfile(user, { displayName: username }).then(() => {
                    // Save mapping in database
                    return set(ref(db, "usernames/" + usernameLower), {
                        email: identifier,
                        displayName: username
                    });
                }).then(() => {
                    // Send verification email
                    return sendEmailVerification(user);
                }).then(() => {
                    // Log out immediately
                    return signOut(auth);
                });
            })
            .then(() => {
                showToast("Account registered! Please check your email to verify.");
                hideModal();
            })
            .catch((error) => {
                errorMsgDiv.innerText = error.message.replace("Firebase: ", "");
                errorMsgDiv.classList.remove("hidden");
            });

        } else {
            // Sign in mode: resolve identifier (could be email or username)
            let emailPromise;
            if (!identifier.includes("@")) {
                const usernameLower = identifier.toLowerCase();
                emailPromise = get(ref(db, "usernames/" + usernameLower)).then(snap => {
                    if (!snap.exists()) {
                        throw new Error("Username not found.");
                    }
                    return snap.val().email;
                });
            } else {
                emailPromise = Promise.resolve(identifier);
            }

            emailPromise.then(resolvedEmail => {
                return signInWithEmailAndPassword(auth, resolvedEmail, password);
            })
            .then((userCredential) => {
                const user = userCredential.user;
                if (!user.emailVerified) {
                    errorMsgDiv.innerText = "Please verify your email address. A verification link has been sent to your inbox.";
                    errorMsgDiv.classList.remove("hidden");
                    
                    // Send verification email before signing out (waiting for it to complete)
                    sendEmailVerification(user)
                        .then(() => {
                            showToast("Verification link sent!");
                        })
                        .catch(err => {
                            console.error("Verification email send error: ", err);
                            showToast("Could not send verification email.");
                        })
                        .finally(() => {
                            signOut(auth);
                        });
                } else {
                    showToast(`Welcome back, ${user.displayName || user.email}!`);
                    hideModal();
                }
            })
            .catch((error) => {
                errorMsgDiv.innerText = error.message.replace("Firebase: ", "");
                errorMsgDiv.classList.remove("hidden");
            });
        }
    });

    // Monitor Auth State Changes to update top navbar, chat prompt, and review prompt
    onAuthStateChanged(auth, (user) => {
        const signinNavBtn = document.getElementById("signin-nav-btn");
        const chatForm = document.getElementById("chat-form");
        const chatPrompt = document.getElementById("chat-login-prompt");
        const reviewForm = document.getElementById("bio-review-form");
        const reviewPrompt = document.getElementById("bio-review-login-prompt");

        if (user) {
            const username = user.displayName || user.email.split("@")[0];
            signinNavBtn.innerText = `LOG OUT (${username.toUpperCase()})`;
            signinNavBtn.style.color = "var(--accent-cyan)";
            
            // Global Chat UI toggle
            if (chatForm) chatForm.classList.remove("hidden");
            if (chatPrompt) chatPrompt.classList.add("hidden");
            
            // Reviews UI toggle
            if (reviewForm) reviewForm.classList.remove("hidden");
            if (reviewPrompt) reviewPrompt.classList.add("hidden");
        } else {
            signinNavBtn.innerText = "SIGN IN";
            signinNavBtn.style.color = "var(--text-secondary)";
            
            // Global Chat UI toggle
            if (chatForm) chatForm.classList.add("hidden");
            if (chatPrompt) chatPrompt.classList.remove("hidden");
            
            // Reviews UI toggle
            if (reviewForm) reviewForm.classList.add("hidden");
            if (reviewPrompt) reviewPrompt.classList.remove("hidden");
        }
    });
}

// 12. Global Chat Controller
function initGlobalChat() {
    const chatWidget = document.getElementById("global-chat-widget");
    const chatToggleBtn = document.getElementById("chat-toggle-btn");
    const chatCloseBtn = document.getElementById("chat-close-btn");
    const chatForm = document.getElementById("chat-form");
    const chatMsgInput = document.getElementById("chat-msg-input");
    const chatSigninTrigger = document.getElementById("chat-signin-trigger");

    chatToggleBtn.addEventListener("click", () => {
        chatWidget.classList.remove("collapsed");
        const badge = document.getElementById("chat-unread-badge");
        badge.innerText = "0";
        badge.classList.add("hidden");
        
        // Scroll messages to bottom on expand
        const messagesDiv = document.getElementById("chat-messages");
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    chatCloseBtn.addEventListener("click", () => {
        chatWidget.classList.add("collapsed");
    });

    chatSigninTrigger.addEventListener("click", () => {
        document.getElementById("signin-nav-btn").click();
    });

    // Hook login trigger in reviews too
    const reviewSigninTrigger = document.getElementById("review-signin-trigger");
    if (reviewSigninTrigger) {
        reviewSigninTrigger.addEventListener("click", () => {
            document.getElementById("signin-nav-btn").click();
        });
    }

    // Connect to Firebase chat stream
    const chatRef = ref(db, 'chat');
    const chatQuery = query(chatRef, limitToLast(50));
    
    window.chatLoadedOnce = false;

    onValue(chatQuery, (snapshot) => {
        const messagesDiv = document.getElementById("chat-messages");
        messagesDiv.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            messagesDiv.innerHTML = '<div class="no-reviews">No messages yet. Say hello! 👋</div>';
            return;
        }

        const sortedKeys = Object.keys(data).sort();
        sortedKeys.forEach(key => {
            const msg = data[key];
            const msgEl = document.createElement("div");
            const isSelf = auth.currentUser && (auth.currentUser.displayName === msg.username);
            msgEl.className = `chat-msg ${isSelf ? 'self' : ''}`;
            
            let timeStr = "";
            try {
                if (msg.timestamp) {
                    const date = new Date(msg.timestamp);
                    timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            } catch(e){}

            msgEl.innerHTML = `
                <div class="chat-msg-meta">
                    <span class="chat-msg-user">${msg.username || 'Anonymous'}</span>
                    <span class="chat-msg-time">${timeStr}</span>
                </div>
                <div class="chat-msg-text">${escapeHTML(msg.text)}</div>
            `;
            messagesDiv.appendChild(msgEl);
        });

        // Scroll to bottom
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // If collapsed, increment badge
        if (chatWidget.classList.contains("collapsed")) {
            if (window.chatLoadedOnce) {
                const badge = document.getElementById("chat-unread-badge");
                let currentCount = parseInt(badge.innerText) || 0;
                badge.innerText = currentCount + 1;
                badge.classList.remove("hidden");
            }
        }
        window.chatLoadedOnce = true;
    });

    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast("Please sign in to send messages.");
            return;
        }

        const text = chatMsgInput.value.trim();
        if (!text) return;

        const newMsgRef = push(ref(db, 'chat'));
        set(newMsgRef, {
            username: user.displayName || user.email.split("@")[0],
            text: text,
            timestamp: serverTimestamp()
        }).then(() => {
            chatMsgInput.value = "";
        }).catch(err => {
            console.error("Chat send error: ", err);
            showToast("Failed to send message.");
        });
    });
}

// 13. Server Reviews Controller
function initReviews() {
    const reviewForm = document.getElementById("bio-review-form");
    const reviewText = document.getElementById("bio-review-text");

    reviewForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showToast("Please sign in to post a review.");
            return;
        }

        if (!window.currentRouteId) {
            showToast("No server selected.");
            return;
        }

        const text = reviewText.value.trim();
        if (!text) return;

        const reviewRef = push(ref(db, `reviews/${window.currentRouteId}`));
        set(reviewRef, {
            username: user.displayName || user.email.split("@")[0],
            text: text,
            timestamp: serverTimestamp()
        }).then(() => {
            reviewText.value = "";
            showToast("Review posted successfully! 💬");
        }).catch(err => {
            console.error("Error posting review: ", err);
            showToast("Failed to post review.");
        });
    });
}

function loadReviews(serverId) {
    const reviewsRef = ref(db, `reviews/${serverId}`);
    
    if (window.unsubscribeReviews) {
        window.unsubscribeReviews();
    }

    window.unsubscribeReviews = onValue(reviewsRef, (snapshot) => {
        const listDiv = document.getElementById("bio-reviews-list");
        listDiv.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            listDiv.innerHTML = '<div class="no-reviews">No reviews yet. Be the first to share your thoughts!</div>';
            return;
        }

        const sortedKeys = Object.keys(data).sort();
        sortedKeys.forEach(key => {
            const review = data[key];
            const itemEl = document.createElement("div");
            itemEl.className = "review-item";

            let dateStr = "Recently";
            try {
                if (review.timestamp) {
                    const date = new Date(review.timestamp);
                    dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            } catch(e){}

            itemEl.innerHTML = `
                <div class="review-meta">
                    <span class="review-author">${review.username || 'Anonymous'}</span>
                    <span class="review-date">${dateStr}</span>
                </div>
                <div class="review-content">${escapeHTML(review.text)}</div>
            `;
            listDiv.appendChild(itemEl);
        });

        // Scroll reviews to bottom
        listDiv.scrollTop = listDiv.scrollHeight;
    });
}

// Utility to escape HTML and prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
