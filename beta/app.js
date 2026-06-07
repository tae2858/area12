import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction, push, set, query, limitToLast } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, GoogleAuthProvider, signInWithPopup, sendEmailVerification, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDSDszN2saYnDRW_9SLPBdo-8cPWIZ709U",
    authDomain: "auth.area12.lol",
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
let isPlaying = false;

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

function toggleVisualizer(play) {
    const visualizer = document.querySelector(".visualizer");
    if (!visualizer) return;
    const bars = visualizer.querySelectorAll(".bar");
    bars.forEach(bar => {
        bar.style.animationPlayState = play ? "running" : "paused";
    });
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

    const bgAudio = document.getElementById("bg-audio");
    const youtubePlayer = document.getElementById("youtube-player");
    const youtubeVideoId = "X4VbdwhkE10";
    let audioSource = null;

    function loadYouTubeStream() {
        // Use our secure HTTPS backend proxy for the Icecast stream
        if (bgAudio) {
            bgAudio.crossOrigin = "anonymous";
            bgAudio.volume = 1.0; // Max volume
            bgAudio.autoplay = false;

            const apiOrigin = API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1")
                ? "http://localhost:8080"
                : "https://multicraft-production.up.railway.app";

            const streamUrl = `${apiOrigin}/api/stream`;
            bgAudio.src = streamUrl;
            audioSource = streamUrl;
            console.log("Background audio secure proxy stream set:", streamUrl);
        }

        // Setup iframe as visual backup
        if (youtubePlayer) {
            youtubePlayer.src = `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=${youtubeVideoId}`;
        }
    }

    function playBackgroundMusic() {
        try {
            if (bgAudio) {
                console.log("Attempting to play audio...");
                console.log("Audio volume:", bgAudio.volume);
                console.log("Audio src:", bgAudio.src);
                console.log("Audio readyState:", bgAudio.readyState);
                console.log("Audio networkState:", bgAudio.networkState);

                bgAudio.volume = 1.0; // Force max volume

                const playPromise = bgAudio.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log("✓ Audio playing successfully");
                            document.querySelector(".song-status").innerText = "PLAYING";
                        })
                        .catch(err => {
                            console.error("✗ Audio play error:", err.message);
                            document.querySelector(".song-status").innerText = "ERROR";
                        });
                }
            }
        } catch (e) {
            console.error("Error playing background music:", e);
        }
    }

    function pauseBackgroundMusic() {
        if (bgAudio) {
            bgAudio.pause();
            console.log("Audio paused");
        }
    }

    function setBackgroundVolume(value) {
        if (bgAudio) {
            bgAudio.volume = Math.max(value, 0.5); // Minimum 50% volume
            console.log("Volume set to:", bgAudio.volume);
        }
    }

    loadYouTubeStream();

    // Typewriter effect trigger
    startTypewriter();

    // Register back button for Guns.lol server profile routing
    document.getElementById("bio-back-btn").addEventListener("click", () => {
        window.history.pushState({}, '', '/beta');
        checkRoute(allServers);
    });

    document.getElementById("credits-link").addEventListener("click", (e) => {
        e.preventDefault();
        window.history.pushState({}, '', '/beta/credits');
        checkRoute(allServers);
    });

    document.getElementById("credits-back-btn").addEventListener("click", () => {
        window.history.pushState({}, '', '/beta');
        checkRoute(allServers);
    });

    const aboutNavLink = document.getElementById("about-nav-link");
    if (aboutNavLink) {
        aboutNavLink.addEventListener("click", (e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/beta/about');
            checkRoute(allServers);
        });
    }

    const aboutBackBtn = document.getElementById("about-back-btn");
    if (aboutBackBtn) {
        aboutBackBtn.addEventListener("click", () => {
            window.history.pushState({}, '', '/beta');
            checkRoute(allServers);
        });
    }

    enterBtn.addEventListener("click", () => {
        enterOverlay.classList.add("hide");
        isPlaying = true;

        playBackgroundMusic();

        // Overwrite system MediaSession details to display "Area 12 Lo-Fi" instead of third-party iframe properties
        if ('mediaSession' in navigator) {
            const updateMediaSession = () => {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: 'Area 12 Lo-Fi',
                    artist: 'Area 12',
                    album: 'Soundtrack',
                    artwork: [
                        { src: window.location.origin + '/beta/logo.png', sizes: '512x512', type: 'image/png' }
                    ]
                });

                // Clear controls handlers to block user pause/skip from OS controls
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
                navigator.mediaSession.setActionHandler('seekbackward', null);
                navigator.mediaSession.setActionHandler('seekforward', null);
                navigator.mediaSession.setActionHandler('previoustrack', null);
                navigator.mediaSession.setActionHandler('nexttrack', null);
            };

            updateMediaSession();
            // Continuously enforce every 3 seconds to override rumble.com updates
            setInterval(updateMediaSession, 3000);
        }

        document.getElementById("music-player-widget").style.transform = "translateX(0)";
        toggleVisualizer(true);
    });

    // Initialize Components
    initAPIPolling();
    initFirebaseAuth();
    initGlobalChat();
    if (window.initMobileUI) {
        window.initMobileUI();
    }

    // Browser navigation back/forward listeners
    window.addEventListener("popstate", () => {
        checkRoute(allServers);
        if (window.syncMobileIndexWithRoute) {
            window.syncMobileIndexWithRoute();
        }
    });

    // Play/Pause Button handler
    if (playPauseBtn) {
        playPauseBtn.addEventListener("click", () => {
            if (!isPlaying) {
                playBackgroundMusic();
                playPauseBtn.innerText = "⏸";
                document.querySelector(".song-status").innerText = "PLAYING";
                toggleVisualizer(true);
                isPlaying = true;
            } else {
                pauseBackgroundMusic();
                playPauseBtn.innerText = "▶";
                document.querySelector(".song-status").innerText = "PAUSED";
                toggleVisualizer(false);
                isPlaying = false;
            }
        });
    }

    // Volume Slider handler
    if (volumeSlider) {
        volumeSlider.addEventListener("input", (e) => {
            setBackgroundVolume(e.target.value);
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

// 3. API Polling Loop (Fetches from Railway proxy and synchronizes with Firebase cache)
function initAPIPolling() {
    const favoriteIds = ["94D92LVD", "QVZACNG5", "XX9IXQ6H"]; // Pinned/favorite slots
    let firebaseCachedServers = {};
    let latestLiveServersMap = new Map();

    // 3.1 Listen to Firebase Cached Servers path
    onValue(ref(db, "cached_servers"), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            firebaseCachedServers = data;
        } else {
            firebaseCachedServers = {};
        }
        mergeAndRenderServers();
    });

    // Helper to merge live polling results with stored Firebase offline servers
    function mergeAndRenderServers() {
        const tempServers = [];
        const mergedIds = new Set();

        // A. Add servers from Firebase Cache (includes live + offline cached ones)
        for (const [sId, sData] of Object.entries(firebaseCachedServers)) {
            if (!sData) continue;
            const sIdUpper = sId.toUpperCase();
            mergedIds.add(sIdUpper);

            const isLive = latestLiveServersMap.has(sIdUpper);
            const liveData = isLive ? latestLiveServersMap.get(sIdUpper) : null;
            const pvpVal = sData.pvp !== false;
            const isFav = favoriteIds.includes(sIdUpper);

            tempServers.push({
                server_id: sIdUpper,
                name: sData.name || "Unknown Server",
                admin: sData.admin || "Unknown",
                players: isLive
                    ? `${liveData.connected_players || 0}/${sData.max_players || 100}`
                    : `0/${sData.max_players || 100}`,
                player_val: isLive ? parseInt(liveData.connected_players || 0, 10) : 0,
                pvp: pvpVal,
                online: isLive,
                description: sData.description || "No room description provided.",
                is_favorite: isFav,
                premium: sData.premium === true || isFav,
                creative_mode: sData.creative_mode === true,
                game: sData.game || "default",
                global_server: sData.global_server === true,
                international: sData.international === true,
                adult: sData.adult === true,
                hardcore: sData.hardcore === true,
                url: sData.url || ""
            });
        }

        // B. Add any live servers not yet represented in the Firebase Cache
        for (const [sId, sData] of latestLiveServersMap.entries()) {
            if (!mergedIds.has(sId)) {
                mergedIds.add(sId);
                const desc = (sData.description || "").replace(/\n/g, " ").trim();
                const isFav = favoriteIds.includes(sId);
                tempServers.push({
                    server_id: sId,
                    name: sData.server_name || "MultiCraft Server",
                    admin: sData.admin_name || "Unknown",
                    players: `${sData.connected_players || 0}/${sData.max_players || 50}`,
                    player_val: parseInt(sData.connected_players || 0, 10),
                    pvp: sData.pvp !== false,
                    online: true,
                    description: desc || "No room description provided.",
                    is_favorite: isFav,
                    premium: sData.premium === true || isFav,
                    creative_mode: sData.creative_mode === true,
                    game: sData.game || "default",
                    global_server: sData.global_server === true,
                    international: sData.international === true,
                    adult: sData.adult === true,
                    hardcore: sData.hardcore === true,
                    url: sData.url || ""
                });
            }
        }

        // C. Safeguard: Fallback defaults for pinned favorites if DB is completely empty
        for (const fId of favoriteIds) {
            if (!mergedIds.has(fId)) {
                mergedIds.add(fId);
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
                    is_favorite: true,
                    premium: true,
                    creative_mode: false,
                    game: "default",
                    global_server: true,
                    international: true,
                    adult: false,
                    hardcore: false,
                    url: fId === "94D92LVD" ? "https://discord.gg/v9NUPx3p78" : ""
                });
            }
        }

        // Sort: Favorites first, then online servers by player count descending, then offline servers
        tempServers.sort((a, b) => {
            if (a.is_favorite && !b.is_favorite) return -1;
            if (!a.is_favorite && b.is_favorite) return 1;
            if (a.online && !b.online) return -1;
            if (!a.online && b.online) return 1;
            return b.player_val - a.player_val;
        });

        allServers = tempServers;

        // Render Lobby Stats Count based on live players
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
        if (window.renderMobileUI) {
            window.renderMobileUI();
        }
        if (window.updateSidebarPortals) {
            window.updateSidebarPortals();
        }
    }

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

                    if (!hasFavorites && !hasNearby && allServers.length > 0) {
                        console.warn("API returned empty data; keeping cached display to prevent flickering.");
                        return;
                    }

                    latestLiveServersMap.clear();

                    // Parse live favorites
                    if (data.favorites && typeof data.favorites === "object") {
                        for (const [sId, sData] of Object.entries(data.favorites)) {
                            if (sData && typeof sData === "object") {
                                const sIdUpper = sId.toUpperCase();
                                latestLiveServersMap.set(sIdUpper, {
                                    server_name: sData.server_name || "",
                                    connected_players: sData.connected_players || 0,
                                    max_players: sData.max_players || 100,
                                    pvp: sData.pvp !== false,
                                    description: sData.description || "",
                                    admin_name: sData.admin_name || sData.admin || "Jared12",
                                    premium: sData.premium === true,
                                    creative_mode: sData.creative_mode === true,
                                    game: sData.game || "default",
                                    global_server: sData.global_server === true,
                                    international: sData.international === true,
                                    adult: sData.adult === true,
                                    hardcore: sData.hardcore === true,
                                    url: sData.url || ""
                                });
                            }
                        }
                    }

                    // Parse live nearby list
                    if (data.nearby && Array.isArray(data.nearby)) {
                        for (const sData of data.nearby) {
                            if (!sData || typeof sData !== "object") continue;
                            const sId = (sData.server_id || sData.id || "").toUpperCase();
                            if (sId) {
                                latestLiveServersMap.set(sId, {
                                    server_name: sData.server_name || sData.name || "MultiCraft Server",
                                    connected_players: sData.connected_players || sData.clients || 0,
                                    max_players: sData.max_players || sData.clients_max || 50,
                                    pvp: sData.pvp !== false,
                                    description: sData.description || "",
                                    admin_name: sData.admin_name || sData.admin || "Unknown",
                                    premium: sData.premium === true,
                                    creative_mode: sData.creative_mode === true,
                                    game: sData.game || "default",
                                    global_server: sData.global_server === true,
                                    international: sData.international === true,
                                    adult: sData.adult === true,
                                    hardcore: sData.hardcore === true,
                                    url: sData.url || ""
                                });
                            }
                        }
                    }

                    // Cache/Update all live servers to Firebase Database in parallel
                    for (const [sId, sData] of latestLiveServersMap.entries()) {
                        const desc = (sData.description || "").replace(/\n/g, " ").trim();
                        const isFav = favoriteIds.includes(sId);
                        set(ref(db, `cached_servers/${sId}`), {
                            server_id: sId,
                            name: sData.server_name || "MultiCraft Server",
                            admin: sData.admin_name || "Unknown",
                            max_players: parseInt(sData.max_players || 50, 10),
                            pvp: sData.pvp !== false,
                            description: desc || "No room description provided.",
                            is_favorite: isFav,
                            premium: sData.premium === true || isFav,
                            creative_mode: sData.creative_mode === true,
                            game: sData.game || "default",
                            global_server: sData.global_server === true,
                            international: sData.international === true,
                            adult: sData.adult === true,
                            hardcore: sData.hardcore === true,
                            url: sData.url || ""
                        }).catch(err => console.error("Firebase caching failed: ", err));
                    }

                    // Perform merge and render
                    mergeAndRenderServers();
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
            window.history.pushState({}, '', '/beta/' + slug);
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
            window.history.pushState({}, '', '/beta/' + slug);
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
    let path = window.location.pathname.toLowerCase();

    // Strip trailing slash if present
    if (path.endsWith('/') && path.length > 1) {
        path = path.slice(0, -1);
    }

    // Extract relative path after /beta
    let relativePath = path;
    if (path.startsWith('/beta')) {
        relativePath = path.substring(5); // strip '/beta'
    }
    relativePath = relativePath.replace(/^\/|\/$/g, '').trim();

    if (!relativePath || relativePath === "index.html" || relativePath === "index") {
        document.getElementById("bio-page-container").classList.add("hidden");
        document.getElementById("credits-page-container").classList.add("hidden");
        document.querySelector(".main-navbar").classList.remove("hidden");
        document.querySelector(".content-container").classList.remove("hidden");
        return;
    }

    if (relativePath === "credits") {
        document.getElementById("credits-page-container").classList.remove("hidden");
        document.getElementById("bio-page-container").classList.add("hidden");
        document.getElementById("about-page-container").classList.add("hidden");
        document.querySelector(".main-navbar").classList.add("hidden");
        document.querySelector(".content-container").classList.add("hidden");
        document.getElementById("enter-overlay").classList.add("hide");
        document.getElementById("music-player-widget").style.transform = "translateX(0)";
        return;
    }

    if (relativePath === "about") {
        document.getElementById("about-page-container").classList.remove("hidden");
        document.getElementById("bio-page-container").classList.add("hidden");
        document.getElementById("credits-page-container").classList.add("hidden");
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
        const pathSanitized = relativePath.replace(/[^a-zA-Z0-9]/g, '');
        return sId === relativePath || slug === relativePath || sNameSanitized === pathSanitized;
    });

    // Fuzzy fallback 1: Prefix match on server ID (min 3 chars)
    if (!matched && relativePath.length >= 3) {
        matched = servers.find(s => s.server_id.toLowerCase().startsWith(relativePath));
    }

    // Fuzzy fallback 2: Check if relativePath is contained inside the server name
    if (!matched && relativePath.length >= 3) {
        matched = servers.find(s => s.name.toLowerCase().includes(relativePath));
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

        // Render Badges
        const badgesContainer = document.getElementById("bio-badges-container");
        if (badgesContainer) {
            badgesContainer.innerHTML = "";
            if (matched.premium) {
                badgesContainer.innerHTML += `<span class="badge premium">⭐ PREMIUM</span>`;
            }
            if (matched.creative_mode) {
                badgesContainer.innerHTML += `<span class="badge creative">🎨 CREATIVE</span>`;
            } else {
                badgesContainer.innerHTML += `<span class="badge survival">🌲 SURVIVAL</span>`;
            }
            if (matched.hardcore) {
                badgesContainer.innerHTML += `<span class="badge hardcore">💀 HARDCORE</span>`;
            }
            if (matched.global_server) {
                badgesContainer.innerHTML += `<span class="badge global">🌍 GLOBAL</span>`;
            }
            if (matched.international) {
                badgesContainer.innerHTML += `<span class="badge intl">🏳️ Intl</span>`;
            }
        }

        // Render Discord/Website button
        const linkBtn = document.getElementById("bio-link-btn");
        if (linkBtn) {
            if (matched.url) {
                linkBtn.href = matched.url;
                linkBtn.classList.remove("hidden");
            } else {
                linkBtn.classList.add("hidden");
            }
        }

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
        window.history.replaceState({}, '', '/beta');
        document.getElementById("bio-page-container").classList.add("hidden");
        document.getElementById("credits-page-container").classList.add("hidden");
        document.getElementById("about-page-container").classList.add("hidden");
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
    let isPasswordlessMode = false;
    let mfaPendingUser = null;
    let mfaPendingCode = null;

    // Globally accessible verification status
    window.isUserEmailVerified = true;

    // Handle Passwordless Sign-In landing link
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Please enter your email to confirm sign-in:');
        }
        if (email) {
            signInWithEmailLink(auth, email, window.location.href)
                .then((result) => {
                    window.localStorage.removeItem('emailForSignIn');
                    window.history.replaceState({}, document.title, window.location.pathname);
                    const user = result.user;
                    showToast("Signed in successfully via email link!");

                    // Setup database profile if new user
                    const userRef = ref(db, `users/${user.uid}/username`);
                    onValue(userRef, (snapshot) => {
                        if (!snapshot.exists()) {
                            const displayName = user.email.split("@")[0];
                            set(ref(db, `users/${user.uid}`), {
                                username: displayName,
                                email: user.email,
                                joinedAt: Date.now()
                            });
                        }
                    }, { onlyOnce: true });
                })
                .catch((error) => {
                    console.error("Email link sign in error:", error);
                    showToast("Failed to sign in: " + error.message, 6000);
                });
        }
    }

    // Email Verification Resend logic
    const resendVerificationBtn = document.getElementById("resend-verification-btn");
    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener("click", () => {
            const user = auth.currentUser;
            if (user) {
                sendEmailVerification(user)
                    .then(() => {
                        showToast("Verification email resent! Please check your inbox.");
                    })
                    .catch((err) => {
                        console.error("Resend error:", err);
                        showToast("Error sending verification: " + err.message);
                    });
            }
        });
    }

    // Profile Settings Modal logic
    const profileModal = document.getElementById("profile-modal");
    const profileCloseBtn = document.getElementById("profile-close-btn");
    const profileEmailDisplay = document.getElementById("profile-email-display");
    const profileMfaStatus = document.getElementById("profile-mfa-status");
    const profileMfaToggleBtn = document.getElementById("profile-mfa-toggle-btn");
    const profileLogoutActionBtn = document.getElementById("profile-logout-action-btn");

    const showProfileModal = () => {
        const user = auth.currentUser;
        if (!user) return;

        profileEmailDisplay.value = user.email;

        onValue(ref(db, `users/${user.uid}/mfaEnabled`), (snapshot) => {
            const mfaEnabled = snapshot.val() || false;
            if (mfaEnabled) {
                profileMfaStatus.innerText = "ENABLED";
                profileMfaStatus.style.color = "var(--green-online)";
                profileMfaToggleBtn.innerText = "DISABLE";
                profileMfaToggleBtn.style.background = "var(--accent-pink)";
            } else {
                profileMfaStatus.innerText = "DISABLED";
                profileMfaStatus.style.color = "var(--accent-pink)";
                profileMfaToggleBtn.innerText = "ENABLE";
                profileMfaToggleBtn.style.background = "var(--accent-cyan)";
            }
        }, { onlyOnce: true });

        profileModal.classList.remove("hidden");
    };

    const hideProfileModal = () => {
        profileModal.classList.add("hidden");
    };

    if (profileCloseBtn) profileCloseBtn.addEventListener("click", hideProfileModal);
    if (profileModal) {
        profileModal.querySelector(".login-modal-overlay").addEventListener("click", hideProfileModal);
    }

    if (profileMfaToggleBtn) {
        profileMfaToggleBtn.addEventListener("click", () => {
            const user = auth.currentUser;
            if (!user) return;

            const isEnabling = profileMfaToggleBtn.innerText === "ENABLE";
            set(ref(db, `users/${user.uid}/mfaEnabled`), isEnabling)
                .then(() => {
                    showToast(isEnabling ? "2-Step Verification enabled!" : "2-Step Verification disabled.");
                    showProfileModal();
                })
                .catch(err => {
                    console.error("2FA setting error:", err);
                    showToast("Error updating settings.");
                });
        });
    }

    if (profileLogoutActionBtn) {
        profileLogoutActionBtn.addEventListener("click", () => {
            signOut(auth).then(() => {
                showToast("Logged out successfully.");
                hideProfileModal();
            });
        });
    }

    const showModal = () => {
        errorMsgDiv.classList.add("hidden");
        loginForm.reset();
        isSignUpMode = false;
        isPasswordlessMode = false;

        // Reset passwordless layout state
        const passwordGroup = document.getElementById("password-group");
        passwordGroup.classList.remove("hidden");
        document.getElementById("login-password").required = true;
        loginToggleBtn.style.display = "inline-block";
        loginToggleText.style.display = "inline-block";
        document.getElementById("passwordless-toggle-btn").innerText = "Use Passwordless Email Sign-In";

        usernameGroup.classList.add("hidden");
        document.getElementById("login-username").required = false;
        loginModalTitle.innerText = "SIGN IN";
        document.querySelector(".login-subtitle").innerText = "Access your Area 12 account";
        loginSubmitBtn.innerText = "SIGN IN";
        loginToggleText.innerText = "Don't have an account?";
        loginToggleBtn.innerText = "Sign Up";

        // Reset MFA panel state
        document.getElementById("login-form-container").classList.remove("hidden");
        document.getElementById("mfa-form-container").classList.add("hidden");
        mfaPendingUser = null;
        mfaPendingCode = null;

        loginModal.classList.remove("hidden");
    };

    const hideModal = () => {
        loginModal.classList.add("hidden");
    };

    signinNavBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (user) {
            showProfileModal();
        } else {
            showModal();
        }
    });

    // Mobile My Profile Trigger
    const mobileMyProfileBtn = document.getElementById("mobile-my-profile-btn");
    if (mobileMyProfileBtn) {
        mobileMyProfileBtn.addEventListener("click", (e) => {
            e.preventDefault();
            showProfileModal();
            const dropdown = document.getElementById("mobile-profile-dropdown");
            if (dropdown) dropdown.classList.add("hidden");
        });
    }

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
            document.getElementById("passwordless-toggle-btn").style.display = "none";
        } else {
            loginModalTitle.innerText = "SIGN IN";
            document.querySelector(".login-subtitle").innerText = "Access your Area 12 account";
            loginSubmitBtn.innerText = "SIGN IN";
            loginToggleText.innerText = "Don't have an account?";
            loginToggleBtn.innerText = "Sign Up";
            usernameGroup.classList.add("hidden");
            document.getElementById("login-username").required = false;
            document.getElementById("passwordless-toggle-btn").style.display = "block";
        }
    });

    // Passwordless Link Mode Toggle
    const passwordlessToggleBtn = document.getElementById("passwordless-toggle-btn");
    const passwordGroup = document.getElementById("password-group");
    if (passwordlessToggleBtn && passwordGroup) {
        passwordlessToggleBtn.addEventListener("click", () => {
            isPasswordlessMode = !isPasswordlessMode;
            errorMsgDiv.classList.add("hidden");
            if (isPasswordlessMode) {
                loginModalTitle.innerText = "PASSWORDLESS SIGN-IN";
                document.querySelector(".login-subtitle").innerText = "Enter your email to receive a passwordless sign-in link";
                loginSubmitBtn.innerText = "SEND SIGN-IN LINK";
                passwordlessToggleBtn.innerText = "Use Password Sign-In";
                passwordGroup.classList.add("hidden");
                document.getElementById("login-password").required = false;
                loginToggleBtn.style.display = "none";
                loginToggleText.style.display = "none";
            } else {
                loginModalTitle.innerText = "SIGN IN";
                document.querySelector(".login-subtitle").innerText = "Access your Area 12 account";
                loginSubmitBtn.innerText = "SIGN IN";
                passwordlessToggleBtn.innerText = "Use Passwordless Email Sign-In";
                passwordGroup.classList.remove("hidden");
                document.getElementById("login-password").required = true;
                loginToggleBtn.style.display = "inline-block";
                loginToggleText.style.display = "inline-block";
            }
        });
    }

    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        errorMsgDiv.classList.add("hidden");

        const email = document.getElementById("login-email").value.trim();

        if (isPasswordlessMode) {
            const actionCodeSettings = {
                url: window.location.href,
                handleCodeInApp: true
            };
            sendSignInLinkToEmail(auth, email, actionCodeSettings)
                .then(() => {
                    window.localStorage.setItem('emailForSignIn', email);
                    showToast("Sign-in link sent! Please check your email inbox.", 8000);
                    hideModal();
                })
                .catch((error) => {
                    errorMsgDiv.innerText = error.message.replace("Firebase: ", "");
                    errorMsgDiv.classList.remove("hidden");
                });
            return;
        }

        const password = document.getElementById("login-password").value;

        if (isSignUpMode) {
            const usernameInput = document.getElementById("login-username").value.trim();
            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    sendEmailVerification(user).then(() => {
                        showToast("Verification email sent! Please check your inbox.");
                    });

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

                    onValue(ref(db, `users/${user.uid}/mfaEnabled`), (snapshot) => {
                        const mfaEnabled = snapshot.val() || false;
                        if (mfaEnabled) {
                            mfaPendingUser = user;
                            mfaPendingCode = String(Math.floor(100000 + Math.random() * 900000));

                            set(ref(db, `users/${user.uid}/mfaCode`), mfaPendingCode).then(() => {
                                showToast(`🔑 [2-STEP SECURITY] Your code is: ${mfaPendingCode} (Check inbox/demo)`, 12000);

                                document.getElementById("login-form-container").classList.add("hidden");
                                document.getElementById("mfa-form-container").classList.remove("hidden");
                                document.getElementById("mfa-code-input").value = "";
                                document.getElementById("mfa-error-msg").classList.add("hidden");
                            });
                        } else {
                            currentUsername = user.displayName || user.email.split("@")[0];
                            signinNavBtn.innerText = `LOG OUT (${currentUsername.toUpperCase()})`;
                            signinNavBtn.style.color = "var(--accent-cyan)";
                            showToast("Welcome back!");
                            hideModal();
                        }
                    }, { onlyOnce: true });
                })
                .catch((error) => {
                    errorMsgDiv.innerText = error.message.replace("Firebase: ", "");
                    errorMsgDiv.classList.remove("hidden");
                });
        }
    });

    // Custom 2FA Input listeners
    const mfaSubmitBtn = document.getElementById("mfa-submit-btn");
    const mfaCancelBtn = document.getElementById("mfa-cancel-btn");
    const mfaCodeInput = document.getElementById("mfa-code-input");
    const mfaErrorMsg = document.getElementById("mfa-error-msg");

    if (mfaSubmitBtn) {
        mfaSubmitBtn.addEventListener("click", () => {
            mfaErrorMsg.classList.add("hidden");
            const inputVal = mfaCodeInput.value.trim();
            if (inputVal === mfaPendingCode) {
                const user = mfaPendingUser;
                currentUsername = user.displayName || user.email.split("@")[0];
                signinNavBtn.innerText = `LOG OUT (${currentUsername.toUpperCase()})`;
                signinNavBtn.style.color = "var(--accent-cyan)";
                showToast("Welcome back!");

                document.getElementById("login-form-container").classList.remove("hidden");
                document.getElementById("mfa-form-container").classList.add("hidden");
                mfaPendingUser = null;
                mfaPendingCode = null;
                hideModal();
            } else {
                mfaErrorMsg.innerText = "Invalid 2-step verification code. Please check your code.";
                mfaErrorMsg.classList.remove("hidden");
            }
        });
    }

    if (mfaCancelBtn) {
        mfaCancelBtn.addEventListener("click", () => {
            signOut(auth).then(() => {
                document.getElementById("login-form-container").classList.remove("hidden");
                document.getElementById("mfa-form-container").classList.add("hidden");
                mfaPendingUser = null;
                mfaPendingCode = null;
                showToast("Verification cancelled.");
            });
        });
    }

    const googleProvider = new GoogleAuthProvider();
    const googleLoginBtn = document.getElementById("google-login-btn");
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener("click", () => {
            errorMsgDiv.classList.add("hidden");
            signInWithPopup(auth, googleProvider)
                .then((result) => {
                    const user = result.user;
                    const userRef = ref(db, `users/${user.uid}/username`);

                    onValue(userRef, (snapshot) => {
                        if (!snapshot.exists()) {
                            const displayName = user.displayName || user.email.split("@")[0];
                            set(ref(db, `users/${user.uid}`), {
                                username: displayName,
                                email: user.email,
                                joinedAt: Date.now()
                            }).then(() => {
                                currentUsername = displayName;
                                showToast(`Welcome ${displayName.toUpperCase()}!`);
                            });
                        } else {
                            currentUsername = snapshot.val();
                            showToast(`Welcome back ${currentUsername.toUpperCase()}!`);
                        }
                    }, { onlyOnce: true });

                    hideModal();
                })
                .catch((error) => {
                    console.error("Google Auth error: ", error);
                    errorMsgDiv.innerText = error.message.replace("Firebase: ", "");
                    errorMsgDiv.classList.remove("hidden");
                });
        });
    }

    onAuthStateChanged(auth, (user) => {
        const verificationBanner = document.getElementById("verification-banner");
        if (user) {
            // Determine email verification status
            const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
            window.isUserEmailVerified = isGoogle || user.emailVerified;

            if (verificationBanner) {
                if (!window.isUserEmailVerified) {
                    verificationBanner.classList.remove("hidden");
                } else {
                    verificationBanner.classList.add("hidden");
                }
            }

            onValue(ref(db, `users/${user.uid}/username`), (snapshot) => {
                const dbUsername = snapshot.val();
                currentUsername = dbUsername || user.displayName || user.email.split("@")[0];
                signinNavBtn.innerText = `LOG OUT (${currentUsername.toUpperCase()})`;
                signinNavBtn.style.color = "var(--accent-cyan)";
            }, (error) => {
                console.error("Failed to load user username ref: ", error);
            });
        } else {
            window.isUserEmailVerified = true; // reset
            if (verificationBanner) verificationBanner.classList.add("hidden");
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
                if (!window.isUserEmailVerified) {
                    showToast("⚠️ Please verify your email address first!");
                    return;
                }
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
                if (!window.isUserEmailVerified) {
                    showToast("⚠️ Please verify your email address first!");
                    return;
                }
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

/* ==========================================================================
   Mobile UI Controller (Wireframe Design)
   ========================================================================== */
let mobileActiveIndex = 0;
let mobileCurrentFilter = "ALL";
let mobileCurrentScale = 1.0;

window.initMobileUI = function () {
    const menuToggle = document.getElementById("mobile-menu-toggle");
    const sidebar = document.getElementById("mobile-sidebar");
    const sidebarClose = document.getElementById("mobile-sidebar-close");
    const profileBtn = document.getElementById("mobile-profile-btn");
    const profileDropdown = document.getElementById("mobile-profile-dropdown");
    const logoutBtn = document.getElementById("mobile-logout-btn");
    const searchToggle = document.getElementById("mobile-search-toggle");
    const searchBar = document.getElementById("mobile-search-bar");
    const searchInput = document.getElementById("mobile-search-input");
    const prevBtn = document.getElementById("mobile-carousel-prev");
    const nextBtn = document.getElementById("mobile-carousel-next");
    const infoBtn = document.getElementById("mobile-info-btn");
    const zoomInBtn = document.getElementById("mobile-zoom-in");
    const zoomOutBtn = document.getElementById("mobile-zoom-out");

    // Sidebar Toggles (Panel 2)
    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.add("open");
        });
    }
    if (sidebarClose && sidebar) {
        sidebarClose.addEventListener("click", () => {
            sidebar.classList.remove("open");
        });
    }

    // Profile Dropdown Actions (Panel 3)
    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const user = auth.currentUser;
            if (!user) {
                document.getElementById("login-modal").classList.remove("hidden");
            } else {
                profileDropdown.classList.toggle("hidden");
            }
        });
    }

    document.addEventListener("click", () => {
        if (profileDropdown) profileDropdown.classList.add("hidden");
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                showToast("Logged out successfully.");
                profileDropdown.classList.add("hidden");
            });
        });
    }

    // Search Toggle Handler
    if (searchToggle && searchBar) {
        searchToggle.addEventListener("click", () => {
            searchBar.classList.toggle("hidden");
            if (!searchBar.classList.contains("hidden") && searchInput) {
                searchInput.focus();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            mobileActiveIndex = 0;
            window.renderMobileUI();
        });
    }

    // Carousel Slider Arrows (Panel 1)
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            mobileActiveIndex--;
            window.renderMobileUI();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            mobileActiveIndex++;
            window.renderMobileUI();
        });
    }

    // Controls Bar Zoom (+ / -) mapped to Cycle Filters
    const MOBILE_FILTERS = ["ALL", "LIT", "LIKED", "PREMIUM", "FOREIGN"];

    const updateFilterUI = (newFilter) => {
        mobileCurrentFilter = newFilter;
        mobileActiveIndex = 0;

        // Highlight active filter button in drawer
        const filterBtns = document.querySelectorAll(".sidebar-filters .filter-btn");
        filterBtns.forEach(btn => {
            if (btn.dataset.filter === mobileCurrentFilter) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        window.renderMobileUI();
    };

    if (zoomInBtn) {
        zoomInBtn.addEventListener("click", () => {
            let idx = MOBILE_FILTERS.indexOf(mobileCurrentFilter);
            idx = (idx + 1) % MOBILE_FILTERS.length;
            updateFilterUI(MOBILE_FILTERS[idx]);
        });
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener("click", () => {
            let idx = MOBILE_FILTERS.indexOf(mobileCurrentFilter);
            idx = (idx - 1 + MOBILE_FILTERS.length) % MOBILE_FILTERS.length;
            updateFilterUI(MOBILE_FILTERS[idx]);
        });
    }

    if (infoBtn) {
        infoBtn.addEventListener("click", () => {
            const detailsTab = document.querySelector(".bottom-tabs .tab-btn[data-tab='details']");
            if (detailsTab) detailsTab.click();
        });
    }

    // Bottom Tabs Selector (Comments, Chat, Details)
    const tabButtons = document.querySelectorAll(".bottom-tabs .tab-btn");
    const tabPanels = document.querySelectorAll(".bottom-content-panel .tab-panel");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const target = btn.dataset.tab;
            tabPanels.forEach(panel => {
                if (panel.id === `mobile-${target}-panel`) {
                    panel.classList.remove("hidden");
                } else {
                    panel.classList.add("hidden");
                }
            });
        });
    });

    // Category Filter Buttons inside Drawer
    const filterButtons = document.querySelectorAll(".sidebar-filters .filter-btn");
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            mobileCurrentFilter = btn.dataset.filter;
            mobileActiveIndex = 0;
            window.renderMobileUI();
            if (sidebar) sidebar.classList.remove("open");
        });
    });

    // Mobile Sidebar Navigation Links Actions
    const mobileHomeLink = document.querySelector(".sidebar-nav [data-target='home']");
    if (mobileHomeLink) {
        mobileHomeLink.addEventListener("click", (e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/beta');
            checkRoute(allServers);
            if (sidebar) sidebar.classList.remove("open");
        });
    }

    const mobileAboutLink = document.querySelector(".sidebar-nav [data-target='about']");
    if (mobileAboutLink) {
        mobileAboutLink.addEventListener("click", (e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/beta/about');
            checkRoute(allServers);
            if (sidebar) sidebar.classList.remove("open");
        });
    }

    // Portals Menu Drawer Toggler
    const portalsLink = document.querySelector(".sidebar-nav [data-target='portals']");
    const portalsContent = document.getElementById("mobile-sidebar-portals");
    if (portalsLink && portalsContent) {
        portalsLink.addEventListener("click", (e) => {
            e.preventDefault();
            portalsContent.classList.toggle("hidden");
            const arrow = portalsLink.querySelector(".arrow");
            if (arrow) {
                arrow.innerText = portalsContent.classList.contains("hidden") ? "▼" : "▲";
            }
        });
    }

    // Initialize Auth state mapping for mobile elements
    onAuthStateChanged(auth, (user) => {
        const dropdownUsername = document.getElementById("mobile-dropdown-username");
        if (user) {
            const displayName = currentUsername || user.displayName || user.email.split("@")[0];
            if (profileBtn) profileBtn.innerText = displayName.toUpperCase();
            if (dropdownUsername) dropdownUsername.innerText = displayName;
        } else {
            if (profileBtn) profileBtn.innerText = "SIGN IN";
            if (dropdownUsername) dropdownUsername.innerText = "Guest User";
        }
    });

    // Initialize Global Chat and Render Mobile Layout
    initMobileGlobalChat();
    window.renderMobileUI();
    window.updateSidebarPortals();
};

window.renderMobileUI = function () {
    const mobileActiveCard = document.getElementById("mobile-active-card");
    if (!mobileActiveCard) return;

    let filtered = allServers;

    // Apply Search Filter
    const searchInput = document.getElementById("mobile-search-input");
    const searchVal = searchInput ? searchInput.value.toLowerCase() : "";
    if (searchVal) {
        filtered = filtered.filter(s => s.name.toLowerCase().includes(searchVal) || s.server_id.toLowerCase().includes(searchVal));
    }

    // Apply Category Filters
    if (mobileCurrentFilter === "PREMIUM") {
        filtered = filtered.filter(s => s.is_favorite);
    } else if (mobileCurrentFilter === "LIKED") {
        filtered = filtered.filter(s => localStorage.getItem(`area12_liked_${s.server_id}`));
    } else if (mobileCurrentFilter === "LIT") {
        filtered = filtered.filter(s => s.online && (parseInt(s.players.split("/")[0], 10) || 0) > 0);
    } else if (mobileCurrentFilter === "FOREIGN") {
        filtered = filtered.filter(s => !s.is_favorite);
    }

    if (filtered.length === 0) {
        mobileActiveCard.innerHTML = `
            <div class="card-top">
                <h2 class="card-server-name">No Servers</h2>
                <p class="card-server-maker">No results matching active filters.</p>
            </div>
        `;
        const codeBadge = document.getElementById("mobile-lit-badge");
        if (codeBadge) codeBadge.innerText = "LIT +0";
        const descPanel = document.getElementById("mobile-details-desc");
        if (descPanel) descPanel.innerText = "No description available.";
        return;
    }

    // Bounds checking
    if (mobileActiveIndex >= filtered.length) {
        mobileActiveIndex = 0;
    } else if (mobileActiveIndex < 0) {
        mobileActiveIndex = filtered.length - 1;
    }

    const server = filtered[mobileActiveIndex];
    const isLiked = localStorage.getItem(`area12_liked_${server.server_id}`);

    // Update active card HTML
    mobileActiveCard.innerHTML = `
        <div class="card-top">
            <h2 class="card-server-name">
                <span>${server.name}</span>
                ${server.is_favorite ? '<span class="star">★</span>' : ''}
            </h2>
            <p class="card-server-maker">${server.admin}</p>
        </div>
        <div class="card-meta">
            <span class="card-invite-code" id="mobile-invite-code-btn">${server.server_id}</span>
            <div class="card-stats">
                <button id="mobile-like-btn" style="color: ${isLiked ? 'var(--accent-yellow)' : 'var(--text-secondary)'}">
                    👍 <span id="mobile-likes-count">0</span>
                </button>
                <button>
                    👁️ <span id="mobile-views-count">0</span>
                </button>
            </div>
        </div>
    `;

    // Handle invite code copy action
    const inviteBtn = document.getElementById("mobile-invite-code-btn");
    if (inviteBtn) {
        inviteBtn.addEventListener("click", () => {
            copyToClipboard(server.server_id);
        });
    }

    // Set up Views & Likes stats listeners
    const viewsRef = ref(db, `stats/${server.server_id}/views`);
    const likesRef = ref(db, `stats/${server.server_id}/likes`);

    onValue(viewsRef, (snap) => {
        const val = snap.val() || 0;
        const el = document.getElementById("mobile-views-count");
        if (el) el.innerText = val.toLocaleString();
    }, (err) => console.error(err));

    onValue(likesRef, (snap) => {
        const val = snap.val() || 0;
        const el = document.getElementById("mobile-likes-count");
        if (el) el.innerText = val.toLocaleString();
    }, (err) => console.error(err));

    const likeActionBtn = document.getElementById("mobile-like-btn");
    if (likeActionBtn) {
        likeActionBtn.addEventListener("click", () => {
            const likeKey = `area12_liked_${server.server_id}`;
            if (localStorage.getItem(likeKey)) {
                showToast("You've already liked this server!");
                return;
            }
            runTransaction(likesRef, (curr) => (curr || 0) + 1).then((res) => {
                if (res.committed) {
                    localStorage.setItem(likeKey, "true");
                    showToast("Server liked! 👍");
                    window.renderMobileUI();
                }
            }).catch(err => console.error(err));
        });
    }

    // Update Lit Player Count Badge
    const activeCount = parseInt(server.players.split("/")[0], 10) || 0;
    const litBadge = document.getElementById("mobile-lit-badge");
    if (litBadge) {
        litBadge.innerText = `LIT +${activeCount}`;
    }

    // Update Details tab text
    const descPanel = document.getElementById("mobile-details-desc");
    if (descPanel) {
        descPanel.innerText = server.description || "No description provided for this server.";
    }

    // Load dynamic server comments in tabs
    loadMobileComments(server.server_id);
};

window.updateSidebarPortals = function () {
    const list = document.getElementById("mobile-sidebar-portals");
    if (!list) return;
    list.innerHTML = "";

    allServers.forEach((server, index) => {
        const link = document.createElement("a");
        link.href = "#";
        link.className = "sidebar-dropdown-link";
        link.innerText = server.name;
        link.addEventListener("click", (e) => {
            e.preventDefault();
            mobileActiveIndex = index;
            mobileCurrentFilter = "ALL";

            // Activate ALL filter button in sidebar
            const allBtn = document.querySelector(".sidebar-filters [data-filter='ALL']");
            if (allBtn) {
                const filters = document.querySelectorAll(".sidebar-filters .filter-btn");
                filters.forEach(f => f.classList.remove("active"));
                allBtn.classList.add("active");
            }

            window.renderMobileUI();

            const sidebar = document.getElementById("mobile-sidebar");
            if (sidebar) sidebar.classList.remove("open");
        });
        list.appendChild(link);
    });
};

window.syncMobileIndexWithRoute = function () {
    let path = window.location.pathname.toLowerCase();
    if (path.startsWith('/beta')) {
        path = path.substring(5);
    }
    path = path.replace(/^\/|\/$/g, '').trim();
    if (!path || path === "credits" || path === "about" || path === "index.html") return;

    const matchedIdx = allServers.findIndex(s => {
        const sId = s.server_id.toLowerCase();
        const slug = getSlug(s.name, s.server_id);
        return sId === path || slug === path;
    });

    if (matchedIdx !== -1) {
        mobileActiveIndex = matchedIdx;
        mobileCurrentFilter = "ALL";
        window.renderMobileUI();
    }
};

function loadMobileComments(serverId) {
    const list = document.getElementById("mobile-comments-list");
    const inputArea = document.getElementById("mobile-comment-input-area");
    if (!list) return;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            inputArea.innerHTML = `
                <form id="mobile-comment-form" class="comment-form" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                    <textarea id="mobile-comment-textarea" class="comment-textarea" placeholder="Share your feedback..." required maxlength="300" style="background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px; border-radius: 6px; height: 50px; font-family: inherit; font-size: 0.85rem; resize: none;"></textarea>
                    <button type="submit" class="comment-submit-btn" style="align-self: flex-end; background: var(--accent-cyan); color: var(--bg-primary); border: none; padding: 6px 14px; border-radius: 4px; font-weight: 800; font-size: 0.75rem;">POST</button>
                </form>
            `;
            const form = document.getElementById("mobile-comment-form");
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                if (!window.isUserEmailVerified) {
                    showToast("⚠️ Please verify your email address first!");
                    return;
                }
                const textEl = document.getElementById("mobile-comment-textarea");
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
                }).catch(err => console.error("Comment error: ", err));
            });
        } else {
            inputArea.innerHTML = `
                <div class="comment-signin-cta">
                    <p style="font-size: 0.8rem;">You must be signed in to comment.</p>
                    <button class="comment-signin-btn" id="mobile-comment-signin-btn">SIGN IN</button>
                </div>
            `;
            document.getElementById("mobile-comment-signin-btn").addEventListener("click", () => {
                document.getElementById("login-modal").classList.remove("hidden");
            });
        }
    });

    onValue(ref(db, `server_comments/${serverId}`), (snapshot) => {
        list.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            list.innerHTML = `<p class="no-comments-msg" style="font-size: 0.8rem; text-align: center; color: var(--text-secondary);">No comments yet.</p>`;
            return;
        }

        const comments = Object.entries(data).map(([id, c]) => ({ id, ...c }));
        comments.sort((a, b) => b.timestamp - a.timestamp);

        comments.forEach(comment => {
            const item = document.createElement("div");
            item.className = "comment-item";
            const date = new Date(comment.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            item.innerHTML = `
                <div class="comment-header" style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 6px;">
                    <span class="comment-author" style="font-weight: 800; color: var(--accent-cyan);">${comment.username.toUpperCase()}</span>
                    <span class="comment-date" style="color: var(--text-secondary); opacity: 0.7;">${date}</span>
                </div>
                <div class="comment-text" style="font-size: 0.85rem; line-height: 1.4; word-break: break-word;">${escapeHtml(comment.text)}</div>
            `;
            list.appendChild(item);
        });
    }, (error) => {
        console.error("Comments fetch error: ", error);
        list.innerHTML = `<p class="no-comments-msg" style="color: var(--accent-pink); font-size: 0.8rem;">Failed to load comments.</p>`;
    });
}

function initMobileGlobalChat() {
    const chatMessages = document.getElementById("mobile-chat-messages");
    const chatInputArea = document.getElementById("mobile-chat-input-area");
    if (!chatMessages) return;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            chatInputArea.innerHTML = `
                <form id="mobile-chat-form" class="chat-form" style="margin-top: 12px; display: flex; flex-direction: row; gap: 8px;">
                    <input type="text" id="mobile-chat-input" class="chat-input" placeholder="Type a message..." required maxlength="120" style="flex: 1; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px; border-radius: 6px; font-size: 0.85rem; outline: none;">
                    <button type="submit" class="chat-send-btn" style="background: var(--accent-cyan); color: var(--bg-primary); border: none; padding: 8px 14px; border-radius: 6px; font-weight: 800;">➔</button>
                </form>
            `;
            const form = document.getElementById("mobile-chat-form");
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                if (!window.isUserEmailVerified) {
                    showToast("⚠️ Please verify your email address first!");
                    return;
                }
                const input = document.getElementById("mobile-chat-input");
                const text = input.value.trim();
                if (!text) return;

                push(ref(db, 'global_chat'), {
                    uid: user.uid,
                    username: currentUsername || user.displayName || user.email.split("@")[0],
                    text: text,
                    timestamp: Date.now()
                }).then(() => {
                    input.value = "";
                }).catch(err => console.error("Chat error: ", err));
            });
        } else {
            chatInputArea.innerHTML = `
                <div class="chat-signin-cta">
                    <p style="font-size: 0.8rem;">You must be signed in to chat.</p>
                    <button class="chat-signin-btn" id="mobile-chat-signin-btn">SIGN IN</button>
                </div>
            `;
            document.getElementById("mobile-chat-signin-btn").addEventListener("click", () => {
                document.getElementById("login-modal").classList.remove("hidden");
            });
        }
    });

    const chatQuery = query(ref(db, 'global_chat'), limitToLast(50));
    onValue(chatQuery, (snapshot) => {
        chatMessages.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            chatMessages.innerHTML = `<p class="no-messages-msg" style="font-size: 0.8rem; text-align: center; color: var(--text-secondary);">No messages yet.</p>`;
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
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

