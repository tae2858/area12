import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction, push, set, query, limitToLast } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDSDszN2saYnDRW_9SLPBdo-8cPWIZ709U",
    authDomain: "area--12.firebaseapp.com",
    databaseURL: "https://area--12-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "area--12",
    storageBucket: "area--12.firebasestorage.app",
    messagingSenderId: "258520899123",
    appId: "1:258520899123:web:b73f0db735cd9f2a2b0d46",
    measurementId: "G-50K0RZ39JK"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

let allServers = [];
let currentUsername = null;

// Environment-aware backend API URL binding
const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8080"
    : "https://multicraft-production.up.railway.app/proxy/find-nearby-servers";

// Typewriter taglines for Guns.lol overlay effect
const TAGLINES = [
    "Scraping the MultiCraft network...",
    "Live server indicators & caps.",
    "Click cards to open profile.",
    "Real-time multiplayer lobbies.",
    "Powered by Area 12."
];

// Slug maps for specific high-priority rooms
const SLUG_TO_ID = {
    "pkcc": "QVZACNG5",
    "parkour": "QVZACNG5",
    "cubicles": "QVZACNG5",
    "smp12": "94D92LVD",
    "ss6": "XX9IXQ6H",
    "stone": "XX9IXQ6H",
    "bunker": "MULL97H1",
    "bunker-pvp": "MULL97H1",
    "bunkerpvp": "MULL97H1"
};

function getSlug(name, id) {
    for (const [slug, mappedId] of Object.entries(SLUG_TO_ID)) {
        if (mappedId === id) return slug;
    }
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

// 1. Entry Overlay & Music Controller
document.addEventListener("DOMContentLoaded", () => {
    const isEmbed = window.self !== window.top || new URLSearchParams(window.location.search).has('embed');
    if (isEmbed) {
        document.body.classList.add("is-embedded");
    }

    const enterBtn = document.getElementById("enter-btn");
    const enterOverlay = document.getElementById("enter-overlay");
    const playPauseBtn = document.getElementById("player-play-pause");
    const volumeSlider = document.getElementById("volume-slider");
    const visualizer = document.querySelector(".visualizer");

    let isPlaying = false;
    const bgAudio = document.getElementById("bg-audio");

    // Typewriter effect trigger
    startTypewriter();

    // Register back button for Guns.lol server profile routing
    document.getElementById("bio-back-btn").addEventListener("click", () => {
        window.history.pushState({}, '', '/');
        checkRoute(allServers);
    });

    document.getElementById("credits-link").addEventListener("click", (e) => {
        e.preventDefault();
        window.history.pushState({}, '', '/credits');
        checkRoute(allServers);
    });

    document.getElementById("credits-back-btn").addEventListener("click", () => {
        window.history.pushState({}, '', '/');
        checkRoute(allServers);
    });

    enterBtn.addEventListener("click", () => {
        enterOverlay.classList.add("hide");
        isPlaying = true;
        
        if (bgAudio) {
            bgAudio.volume = volumeSlider ? volumeSlider.value : 0.5;
            bgAudio.play().catch(err => {
                console.error("Audio playback failed to start: ", err);
            });
        }

        document.getElementById("music-player-widget").style.transform = "translateX(0)";
        toggleVisualizer(true);
    });

    // Initialize Components
    initAPIPolling();
    initFirebaseAuth();
    initGlobalChat();

    // Browser navigation back/forward listeners
    window.addEventListener("popstate", () => {
        checkRoute(allServers);
    });

    // Play/Pause Button handler
    playPauseBtn.addEventListener("click", () => {
        if (!bgAudio) return;
        if (!isPlaying) {
            bgAudio.play().catch(err => {
                console.error("Audio play failed: ", err);
            });
            playPauseBtn.innerText = "⏸";
            document.querySelector(".song-status").innerText = "PLAYING";
            toggleVisualizer(true);
            isPlaying = true;
        } else {
            bgAudio.pause();
            playPauseBtn.innerText = "▶";
            document.querySelector(".song-status").innerText = "PAUSED";
            toggleVisualizer(false);
            isPlaying = false;
        }
    });

    // Volume Slider handler
    if (volumeSlider) {
        volumeSlider.addEventListener("input", (e) => {
            if (bgAudio) {
                bgAudio.volume = e.target.value;
            }
        });
    }

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
    if (!element) return;
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
            delay = 2000;
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

// 3. API Polling Loop (Fetches from Railway proxy every 5 seconds)
function initAPIPolling() {
    const favoriteIds = ["94D92LVD", "QVZACNG5", "XX9IXQ6H"];
    const fetchServers = async () => {
        try {
            const response = await fetch("https://multicraft-production.up.railway.app/proxy/find-nearby-servers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ favorites: "94D92LVD,QVZACNG5,XX9IXQ6H" })
            });
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    const hasFavorites = data.favorites && typeof data.favorites === "object" && Object.keys(data.favorites).length > 0;
                    const hasNearby = data.nearby && Array.isArray(data.nearby) && data.nearby.length > 0;

                    // Skip updating if response is empty (likely rate-limited) and we already have cached servers
                    if (!hasFavorites && !hasNearby && allServers.length > 0) {
                        console.warn("API returned empty data; keeping cached servers to prevent flickering.");
                        return;
                    }

                    const tempServers = [];
                    const foundFavorites = new Set();

                    // 1. Process favorites block (nested dict keyed by server ID)
                    if (data.favorites && typeof data.favorites === "object") {
                        for (const [sId, sData] of Object.entries(data.favorites)) {
                            const sIdUpper = sId.toUpperCase();
                            if (favoriteIds.includes(sIdUpper) && sData && typeof sData === "object") {
                                foundFavorites.add(sIdUpper);
                                const desc = (sData.description || "").replace(/\n/g, " ").trim();
                                tempServers.push({
                                    server_id: sIdUpper,
                                    name: sData.server_name || "",
                                    admin: "Jared12, Nice, Angels",
                                    players: `${sData.connected_players || 0}/${sData.max_players || 100}`,
                                    player_val: parseInt(sData.connected_players || 0, 10),
                                    pvp: sData.pvp !== false,
                                    online: sData.online !== false,
                                    description: desc || "No room description provided.",
                                    is_favorite: true
                                });
                            }
                        }
                    }

                    // 2. Inject missing/offline favorites
                    for (const fId of favoriteIds) {
                        if (!foundFavorites.has(fId)) {
                            let defaultName = "Unknown Server";
                            if (fId === "QVZACNG5") defaultName = "Parkour Cubicles [12+]";
                            else if (fId === "94D92LVD") defaultName = "[12+] ※SMP12※";
                            else if (fId === "XX9IXQ6H") defaultName = "[12+] ※Stone Simulator!※";

                            tempServers.push({
                                server_id: fId,
                                name: defaultName,
                                admin: "Jared12, Nice, Angels",
                                players: "0/100",
                                player_val: 0,
                                pvp: true,
                                online: false,
                                description: "Server is currently sleeping or offline.",
                                is_favorite: true
                            });
                        }
                    }

                    // 3. Process nearby servers from the list
                    if (data.nearby && Array.isArray(data.nearby)) {
                        for (const sData of data.nearby) {
                            if (!sData || typeof sData !== "object") continue;
                            const sId = (sData.server_id || sData.id || "").toUpperCase();
                            if (favoriteIds.includes(sId)) continue; // skip, already handled

                            const desc = (sData.description || "").replace(/\n/g, " ").trim();
                            tempServers.push({
                                server_id: sId || "UNKNOWN",
                                name: sData.server_name || sData.name || "MultiCraft Server",
                                admin: sData.admin_name || sData.admin || "Unknown",
                                players: `${sData.connected_players || sData.clients || 0}/${sData.max_players || sData.clients_max || 50}`,
                                player_val: parseInt(sData.connected_players || sData.clients || 0, 10),
                                pvp: sData.pvp !== false,
                                online: sData.online !== false,
                                description: desc || "No room description provided.",
                                is_favorite: false
                            });
                        }
                    }

                    // Sort: Favorites first, then other online servers by player count descending
                    tempServers.sort((a, b) => {
                        if (a.is_favorite && !b.is_favorite) return -1;
                        if (!a.is_favorite && b.is_favorite) return 1;
                        return b.player_val - a.player_val;
                    });

                    allServers = tempServers;

                    // Update total online counts or lobby label based on total active players
                    let totalPlayers = 0;
                    allServers.forEach(s => {
                        if (s.online) {
                            const count = parseInt(s.players.split("/")[0], 10) || 0;
                            totalPlayers += count;
                        }
                    });
                    document.getElementById("lobby-counter").innerText = `${totalPlayers} PLAYERS ONLINE ACROSS ALL NETWORKS`;

                    renderPinnedFavorites(allServers);
                    renderDirectoryGrid(allServers);
                    checkRoute(allServers);
                } else {
                    document.getElementById("lobby-counter").innerText = "Waiting for background server engine synchronizer...";
                }
            } else {
                document.getElementById("lobby-counter").innerText = "Backend error: Status " + response.status;
            }
        } catch (error) {
            console.error("API polling failed: ", error);
            document.getElementById("lobby-counter").innerText = "Backend connection offline. Retrying...";
        }
    };

    fetchServers();
    setInterval(fetchServers, 15000);
}

// 4. Render Pinned Favorites (Subscription-style Cards)
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
        card.style.cursor = "pointer";

        card.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
                return;
            }
            const slug = getSlug(server.name, server.server_id);
            window.history.pushState({}, '', '/' + slug);
            checkRoute(allServers);
        });

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

// 5. Render All Active Servers (Searchable Grid)
function renderDirectoryGrid(servers) {
    const searchVal = document.getElementById("search-input").value.toLowerCase();
    const container = document.getElementById("server-grid");
    container.innerHTML = "";

    const filtered = servers.filter(s => {
        return s.name.toLowerCase().includes(searchVal) || s.server_id.toLowerCase().includes(searchVal);
    });

    document.getElementById("lobby-counter").innerText = `Showing ${filtered.length} Live Network Rooms`;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="no-results" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary)">No lobbies matching "${searchVal}" found</div>`;
        return;
    }

    filtered.forEach(server => {
        let pct = 0;
        try {
            const parts = server.players.split("/");
            if (parts.length === 2 && parseInt(parts[1]) > 0) {
                pct = (parseInt(parts[0]) / parseInt(parts[1])) * 100;
            }
        } catch (e) { }

        const card = document.createElement("div");
        card.className = "server-card";
        card.style.cursor = "pointer";

        card.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
                return;
            }
            const slug = getSlug(server.name, server.server_id);
            window.history.pushState({}, '', '/' + slug);
            checkRoute(allServers);
        });

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

// 6. Dynamic Search Input Key Listener
document.getElementById("search-input").addEventListener("input", () => {
    renderDirectoryGrid(allServers);
});

// 7. Clipboard Copy Utility with Toast triggers
window.copyToClipboard = function (text) {
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

// 8. Guns.lol Profile Routing System
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

    // Locate server matching ID or slug or sanitized title (alphanumeric only)
    let matched = servers.find(s => {
        const sId = s.server_id.toLowerCase();
        const slug = getSlug(s.name, s.server_id);
        const sNameSanitized = s.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const pathSanitized = path.replace(/[^a-zA-Z0-9]/g, '');
        return sId === path || slug === path || sNameSanitized === pathSanitized;
    });

    // Fuzzy fallback 1: Prefix match on server ID (min 3 chars)
    if (!matched && path.length >= 3) {
        matched = servers.find(s => s.server_id.toLowerCase().startsWith(path));
    }

    // Fuzzy fallback 2: Check if path is contained inside the server name
    if (!matched && path.length >= 3) {
        matched = servers.find(s => s.name.toLowerCase().includes(path));
    }

    if (matched) {
        document.getElementById("bio-page-container").classList.remove("hidden");
        document.getElementById("credits-page-container").classList.add("hidden");
        document.querySelector(".main-navbar").classList.add("hidden");
        document.querySelector(".content-container").classList.add("hidden");
        document.getElementById("enter-overlay").classList.add("hide");

        document.getElementById("bio-server-name").innerText = matched.name.toUpperCase();
        document.getElementById("bio-maker").innerText = matched.admin;
        document.getElementById("bio-players").innerText = matched.players;
        document.getElementById("bio-pvp").innerText = matched.pvp ? "⚔️ PvP Enabled" : "🌾 Safe Zone";
        document.getElementById("bio-invite-code").innerText = matched.server_id;

        document.getElementById("music-player-widget").style.transform = "translateX(0)";

        startBioTypewriter(matched.description);

        const serverId = matched.server_id;
        const statsViewsRef = ref(db, `stats/${serverId}/views`);
        const statsLikesRef = ref(db, `stats/${serverId}/likes`);

        if (window.currentRouteId !== serverId) {
            window.currentRouteId = serverId;
            runTransaction(statsViewsRef, (currentViews) => {
                return (currentViews || 0) + 1;
            });
        }

        onValue(statsViewsRef, (snapshot) => {
            document.getElementById("bio-views-count").innerText = (snapshot.val() || 0).toLocaleString();
        }, (error) => {
            console.error("Failed to load views: ", error);
        });

        onValue(statsLikesRef, (snapshot) => {
            document.getElementById("bio-likes-count").innerText = (snapshot.val() || 0).toLocaleString();
        }, (error) => {
            console.error("Failed to load likes: ", error);
        });

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

        // Load Comments
        loadServerComments(serverId);

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
        window.history.replaceState({}, '', '/');
        document.getElementById("bio-page-container").classList.add("hidden");
        document.getElementById("credits-page-container").classList.add("hidden");
        document.querySelector(".main-navbar").classList.remove("hidden");
        document.querySelector(".content-container").classList.remove("hidden");
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

// 9. Firebase Authentication Controller
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
    const usernameGroup = document.getElementById("username-group");

    let isSignUpMode = false;

    const showModal = () => {
        errorMsgDiv.classList.add("hidden");
        loginForm.reset();
        isSignUpMode = false;
        usernameGroup.classList.add("hidden");
        document.getElementById("login-username").required = false;
        loginModalTitle.innerText = "SIGN IN";
        document.querySelector(".login-subtitle").innerText = "Access your Area 12 account";
        loginSubmitBtn.innerText = "SIGN IN";
        loginToggleText.innerText = "Don't have an account?";
        loginToggleBtn.innerText = "Sign Up";
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

    loginToggleBtn.addEventListener("click", () => {
        isSignUpMode = !isSignUpMode;
        errorMsgDiv.classList.add("hidden");
        if (isSignUpMode) {
            loginModalTitle.innerText = "SIGN UP";
            document.querySelector(".login-subtitle").innerText = "Create your Area 12 account";
            loginSubmitBtn.innerText = "SIGN UP";
            loginToggleText.innerText = "Already have an account?";
            loginToggleBtn.innerText = "Sign In";
            usernameGroup.classList.remove("hidden");
            document.getElementById("login-username").required = true;
        } else {
            loginModalTitle.innerText = "SIGN IN";
            document.querySelector(".login-subtitle").innerText = "Access your Area 12 account";
            loginSubmitBtn.innerText = "SIGN IN";
            loginToggleText.innerText = "Don't have an account?";
            loginToggleBtn.innerText = "Sign Up";
            usernameGroup.classList.add("hidden");
            document.getElementById("login-username").required = false;
        }
    });

    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        errorMsgDiv.classList.add("hidden");

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        if (isSignUpMode) {
            const usernameInput = document.getElementById("login-username").value.trim();
            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    updateProfile(user, { displayName: usernameInput })
                        .then(() => {
                            set(ref(db, `users/${user.uid}`), { username: usernameInput }).then(() => {
                                currentUsername = usernameInput;
                                signinNavBtn.innerText = `LOG OUT (${currentUsername.toUpperCase()})`;
                                signinNavBtn.style.color = "var(--accent-cyan)";
                                showToast("Account created successfully!");
                                hideModal();
                            }).catch(err => {
                                console.error("Database save error: ", err);
                                currentUsername = usernameInput;
                                signinNavBtn.innerText = `LOG OUT (${currentUsername.toUpperCase()})`;
                                signinNavBtn.style.color = "var(--accent-cyan)";
                                showToast("Account created!");
                                hideModal();
                            });
                        })
                        .catch((err) => {
                            console.error("Profile update error: ", err);
                            currentUsername = usernameInput;
                            signinNavBtn.innerText = `LOG OUT (${currentUsername.toUpperCase()})`;
                            signinNavBtn.style.color = "var(--accent-cyan)";
                            showToast("Account created!");
                            hideModal();
                        });
                })
                .catch((error) => {
                    errorMsgDiv.innerText = error.message.replace("Firebase: ", "");
                    errorMsgDiv.classList.remove("hidden");
                });
        } else {
            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    currentUsername = user.displayName || user.email.split("@")[0];
                    signinNavBtn.innerText = `LOG OUT (${currentUsername.toUpperCase()})`;
                    signinNavBtn.style.color = "var(--accent-cyan)";
                    showToast("Welcome back!");
                    hideModal();
                })
                .catch((error) => {
                    errorMsgDiv.innerText = error.message.replace("Firebase: ", "");
                    errorMsgDiv.classList.remove("hidden");
                });
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            onValue(ref(db, `users/${user.uid}/username`), (snapshot) => {
                const dbUsername = snapshot.val();
                currentUsername = dbUsername || user.displayName || user.email.split("@")[0];
                signinNavBtn.innerText = `LOG OUT (${currentUsername.toUpperCase()})`;
                signinNavBtn.style.color = "var(--accent-cyan)";
            }, (error) => {
                console.error("Failed to load user username ref: ", error);
            });
        } else {
            currentUsername = null;
            signinNavBtn.innerText = "SIGN IN";
            signinNavBtn.style.color = "var(--text-secondary)";
        }
    });
}

// 10. Global Chat Controller
function initGlobalChat() {
    const chatToggleBtn = document.getElementById("chat-toggle-btn");
    const chatCloseBtn = document.getElementById("chat-close-btn");
    const chatBox = document.getElementById("chat-box");
    const chatMessages = document.getElementById("chat-messages");
    const chatInputArea = document.getElementById("chat-input-area");
    const chatBadge = document.getElementById("chat-badge");

    let unreadCount = 0;
    let isChatOpen = false;

    chatToggleBtn.addEventListener("click", () => {
        isChatOpen = !isChatOpen;
        chatBox.classList.toggle("hidden");
        if (isChatOpen) {
            unreadCount = 0;
            chatBadge.classList.add("hidden");
            chatBadge.innerText = "0";
            setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 100);
        }
    });

    chatCloseBtn.addEventListener("click", () => {
        isChatOpen = false;
        chatBox.classList.add("hidden");
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            chatInputArea.innerHTML = `
                <form id="chat-form" class="chat-form">
                    <input type="text" id="chat-input" class="chat-input" placeholder="Type a message..." required maxlength="120" autocomplete="off">
                    <button type="submit" class="chat-send-btn">➔</button>
                </form>
            `;
            const chatForm = document.getElementById("chat-form");
            chatForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const chatInput = document.getElementById("chat-input");
                const text = chatInput.value.trim();
                if (!text) return;

                push(ref(db, 'global_chat'), {
                    uid: user.uid,
                    username: currentUsername || user.displayName || user.email.split("@")[0],
                    text: text,
                    timestamp: Date.now()
                }).then(() => {
                    chatInput.value = "";
                }).catch(err => {
                    console.error("Chat error: ", err);
                });
            });
        } else {
            chatInputArea.innerHTML = `
                <div class="chat-signin-cta">
                    <p>You must be signed in to chat.</p>
                    <button class="chat-signin-btn" id="chat-signin-btn-widget">SIGN IN</button>
                </div>
            `;
            const signinBtn = document.getElementById("chat-signin-btn-widget");
            signinBtn.addEventListener("click", () => {
                document.getElementById("login-modal").classList.remove("hidden");
            });
        }
    });

    const chatQuery = query(ref(db, 'global_chat'), limitToLast(50));
    onValue(chatQuery, (snapshot) => {
        chatMessages.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            chatMessages.innerHTML = `<p class="no-messages-msg">No messages yet. Send a message to start the conversation!</p>`;
            return;
        }

        const messages = Object.entries(data).map(([id, msg]) => ({ id, ...msg }));
        messages.sort((a, b) => a.timestamp - b.timestamp);

        messages.forEach(msg => {
            const msgEl = document.createElement("div");
            const isSelf = auth.currentUser && msg.uid === auth.currentUser.uid;
            msgEl.className = `chat-msg ${isSelf ? 'self' : ''}`;

            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            msgEl.innerHTML = `
                <div class="chat-msg-header">
                    <span class="chat-msg-user">${msg.username.toUpperCase()}</span>
                    <span class="chat-msg-time">${time}</span>
                </div>
                <div class="chat-msg-text">${escapeHtml(msg.text)}</div>
            `;
            chatMessages.appendChild(msgEl);
        });

        if (!isChatOpen) {
            unreadCount++;
            chatBadge.innerText = unreadCount;
            chatBadge.classList.remove("hidden");
        } else {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }, (error) => {
        console.error("Chat fetch error: ", error);
        chatMessages.innerHTML = `<p class="no-messages-msg" style="color: var(--accent-pink);">Failed to load chat messages (Permission Denied). Please verify your Firebase Database Rules allow public read access.</p>`;
    });
}

// 11. Comments Controller
function loadServerComments(serverId) {
    const commentsContainer = document.getElementById("comments-container");
    const commentInputArea = document.getElementById("comment-input-area");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            commentInputArea.innerHTML = `
                <form id="comment-form" class="comment-form">
                    <textarea id="comment-textarea" class="comment-textarea" placeholder="Share your feedback..." required maxlength="300"></textarea>
                    <button type="submit" class="comment-submit-btn">POST COMMENT</button>
                </form>
            `;
            const commentForm = document.getElementById("comment-form");
            commentForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const textEl = document.getElementById("comment-textarea");
                const text = textEl.value.trim();
                if (!text) return;

                push(ref(db, `server_comments/${serverId}`), {
                    uid: user.uid,
                    username: currentUsername || user.displayName || user.email.split("@")[0],
                    text: text,
                    timestamp: Date.now(),
                    likes: 0,
                    dislikes: 0
                }).then(() => {
                    textEl.value = "";
                    showToast("Comment posted!");
                }).catch(err => {
                    console.error("Comment error: ", err);
                });
            });
        } else {
            commentInputArea.innerHTML = `
                <div class="comment-signin-cta">
                    <p>You must be signed in to comment.</p>
                    <button class="comment-signin-btn" id="comment-signin-btn-bio">SIGN IN</button>
                </div>
            `;
            document.getElementById("comment-signin-btn-bio").addEventListener("click", () => {
                document.getElementById("login-modal").classList.remove("hidden");
            });
        }
    });

    onValue(ref(db, `server_comments/${serverId}`), (snapshot) => {
        commentsContainer.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            commentsContainer.innerHTML = `<p class="no-comments-msg">No comments yet. Be the first to share your thoughts!</p>`;
            return;
        }

        const comments = Object.entries(data).map(([id, c]) => ({ id, ...c }));
        comments.sort((a, b) => b.timestamp - a.timestamp);

        comments.forEach(comment => {
            const item = document.createElement("div");
            item.className = "comment-item";

            const date = new Date(comment.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            item.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.username.toUpperCase()}</span>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
                <div class="comment-footer">
                    <button class="comment-vote-btn like" data-id="${comment.id}">
                        👍 <span>${comment.likes || 0}</span>
                    </button>
                    <button class="comment-vote-btn dislike" data-id="${comment.id}">
                        👎 <span>${comment.dislikes || 0}</span>
                    </button>
                </div>
            `;

            const likeBtn = item.querySelector(".comment-vote-btn.like");
            const dislikeBtn = item.querySelector(".comment-vote-btn.dislike");

            likeBtn.onclick = () => voteComment(serverId, comment.id, 'likes');
            dislikeBtn.onclick = () => voteComment(serverId, comment.id, 'dislikes');

            commentsContainer.appendChild(item);
        });
    }, (error) => {
        console.error("Comments fetch error: ", error);
        commentsContainer.innerHTML = `<p class="no-comments-msg" style="color: var(--accent-pink);">Failed to load comments (Permission Denied). Please verify your Firebase Database Rules allow public read access.</p>`;
    });
}

function voteComment(serverId, commentId, voteType) {
    const voteKey = `voted_${commentId}`;
    if (localStorage.getItem(voteKey)) {
        showToast("You have already voted on this comment.");
        return;
    }

    const voteRef = ref(db, `server_comments/${serverId}/${commentId}/${voteType}`);
    runTransaction(voteRef, (curr) => {
        return (curr || 0) + 1;
    }).then((result) => {
        if (result.committed) {
            localStorage.setItem(voteKey, "true");
        }
    }).catch(err => {
        console.error("Voting error: ", err);
    });
}
