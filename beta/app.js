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
const activeVoteRequests = new Set();
let currentSort = "LIT";
let currentFilter = "ALL";

const BASE_PATH = window.location.pathname.startsWith('/beta') ? '/beta/' : '/';

// Environment-aware backend API URL binding
const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8080"
    : atob("aHR0cHM6Ly9tdWx0aWNyYWZ0LXByb2R1Y3Rpb24udXAucmFpbHdheS5hcHAvcHJveHkvZmluZC1uZWFyYnktc2VydmVycw==");

// Typewriter taglines for Guns.lol overlay effect
const TAGLINES = [
    "Scraping the MultiCraft portals...",
    "Live server indicators & caps.",
    "Click cards to open profile.",
    "Real-time multiplayer lobbies.",
    "Powered by Area 12."
];

const MAKERS_DATA = [
    {
        username: "Jared12",
        displayName: "Jared12",
        role: "Maker of Area 12 + UI/UX Director",
        bio: "Founder and Lead UI/UX Director of Area 12. Passionate about designing immersive pixel-perfect interfaces and orchestrating multiplayer server portals.",
        discord: "jared12",
        image: "Untitled3_20260608042222.png",
        pinned: true
    },
    {
        username: "Nice",
        displayName: "Nice",
        role: "Maker of Area 12",
        bio: "Core designer and portal maker of Area 12. Specializes in custom server mechanics and multiplayer layout design.",
        discord: "nice12",
        image: "Untitled3_20260608042814.png",
        pinned: true
    },
    {
        username: "Angels",
        displayName: "Angels",
        role: "Maker of Area 12",
        bio: "Co-creator of Area 12. Manages community growth, staff orchestration, and official portal server events.",
        discord: "angels12",
        image: "Untitled3_20260608045541.png",
        pinned: true
    },
    {
        username: "ziadlive",
        displayName: "ziadlive",
        role: "Maker of Vulkan + Lead Developer",
        bio: "Lead Developer of Vulkan and co-creator of the Area 12 directory application. Focused on database efficiency and server performance.",
        discord: "ziadlive",
        image: "Untitled2_20260608024404.png",
        pinned: false
    },
    {
        username: "accusebroski_",
        displayName: "accusebroski_",
        role: "Vulkan Developer",
        bio: "Fullstack developer for Vulkan portal integrations. Built the modular server details framework and global chat sync systems.",
        discord: "accusebroski_",
        image: "Untitled3_20260608050242.png",
        pinned: false
    },
    {
        username: "x9jm",
        displayName: "x9jm",
        role: "Vulkan Developer",
        bio: "Gameplay engineer and server systems builder. Specializes in Vulkan netcode, performance monitoring, and server plugins.",
        discord: "x9jm",
        image: "Untitled3_20260608103604.png",
        pinned: false
    },
    {
        username: "Blade",
        displayName: "Blade",
        role: "Vulkan Developer",
        bio: "DevOps specialist and backend systems engineer. Manages database deployments, cloud proxy clusters, and server redundancy.",
        discord: "blade12",
        image: "Untitled3_20260608104118.png",
        pinned: false
    }
];

// Slug maps for specific high-priority portals
const SLUG_TO_ID = {
    "pkcc": "QVZACNG5",
    "parkour": "QVZACNG5",
    "cubicles": "QVZACNG5",
    "smp12": "94D92LVD",
    "ss6": "XX9IXQ6H",
    "stone": "XX9IXQ6H",

};

function getSlug(name, id) {
    for (const [slug, mappedId] of Object.entries(SLUG_TO_ID)) {
        if (mappedId === id) return slug;
    }
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function getServerSlug(server) {
    if (!server) return "";
    for (const [slug, mappedId] of Object.entries(SLUG_TO_ID)) {
        if (mappedId === server.server_id) return slug;
    }
    if (server.is_registered === false) {
        return "r-" + server.server_id.toLowerCase();
    }
    return server.name.toLowerCase()
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

// Init dual controls (Sort and Filters) for both desktop and mobile
function initControls() {
    // Desktop Sort Buttons
    document.querySelectorAll(".sort-controls .sort-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".sort-controls .sort-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const sortVal = btn.getAttribute("data-sort");
            currentSort = sortVal;

            // Sync mobile sort active state
            const mobileBtn = document.querySelector(`.mobile-sort-box .filter-btn[data-sort="${sortVal}"]`);
            if (mobileBtn) {
                document.querySelectorAll(".mobile-sort-box .filter-btn").forEach(b => b.classList.remove("active"));
                mobileBtn.classList.add("active");
            }

            renderDirectoryGrid(allServers);
        });
    });

    // Desktop Filter Buttons
    document.querySelectorAll(".filter-controls .filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-controls .filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const filterVal = btn.getAttribute("data-filter");
            currentFilter = filterVal;

            // Sync mobile filter active state
            const mobileBtn = document.querySelector(`.mobile-filter-box .filter-btn[data-filter="${filterVal}"]`);
            if (mobileBtn) {
                document.querySelectorAll(".mobile-filter-box .filter-btn").forEach(b => b.classList.remove("active"));
                mobileBtn.classList.add("active");
            }

            renderDirectoryGrid(allServers);
        });
    });

    // Mobile Sort Buttons
    document.querySelectorAll(".mobile-sort-box .filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".mobile-sort-box .filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const sortVal = btn.getAttribute("data-sort");
            currentSort = sortVal;
            
            // Sync desktop sort active state
            const desktopBtn = document.querySelector(`.sort-controls .sort-btn[data-sort="${sortVal}"]`);
            if (desktopBtn) {
                document.querySelectorAll(".sort-controls .sort-btn").forEach(b => b.classList.remove("active"));
                desktopBtn.classList.add("active");
            }

            if (typeof mobileActiveIndex !== "undefined") {
                mobileActiveIndex = 0;
            }
            if (window.renderMobileUI) window.renderMobileUI();
            renderDirectoryGrid(allServers);
        });
    });

    // Mobile Filter Buttons
    document.querySelectorAll(".mobile-filter-box .filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".mobile-filter-box .filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const filterVal = btn.getAttribute("data-filter");
            currentFilter = filterVal;
            if (typeof mobileCurrentFilter !== "undefined") {
                mobileCurrentFilter = filterVal;
            }

            // Sync desktop filter active state
            const desktopBtn = document.querySelector(`.filter-controls .filter-btn[data-filter="${filterVal}"]`);
            if (desktopBtn) {
                document.querySelectorAll(".filter-controls .filter-btn").forEach(b => b.classList.remove("active"));
                desktopBtn.classList.add("active");
            }

            if (typeof mobileActiveIndex !== "undefined") {
                mobileActiveIndex = 0;
            }
            if (window.renderMobileUI) window.renderMobileUI();
            renderDirectoryGrid(allServers);
        });
    });
}

// 1. Entry Overlay & Music Controller
function initBetaApp() {
    const isEmbed = window.self !== window.top || new URLSearchParams(window.location.search).has('embed');
    if (isEmbed) {
        document.body.classList.add("is-embedded");
    }

    const clickSound = new Audio(BASE_PATH + 'assets/a12.click.mp3');
    const upvoteSound = new Audio(BASE_PATH + 'assets/a12.upvote.mp3');
    const downvoteSound = new Audio(BASE_PATH + 'assets/a12.downvote.mp3');
    clickSound.volume = 1.0;
    upvoteSound.volume = 1.0;
    downvoteSound.volume = 1.0;

    window.playClickSound = function () {
        clickSound.currentTime = 0;
        clickSound.play().catch(e => console.log("Sound play error: ", e));
    };
    window.playUpvoteSound = function () {
        upvoteSound.currentTime = 0;
        upvoteSound.play().catch(e => console.log("Sound play error: ", e));
    };
    window.playDownvoteSound = function () {
        downvoteSound.currentTime = 0;
        downvoteSound.play().catch(e => console.log("Sound play error: ", e));
    };

    // Global click listener for UI elements
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('button, a, input[type="submit"], input[type="button"], .server-card, .sidebar-link, .tab-btn, .bio-invite-code, .enter-btn, .close-btn');
        if (target) {
            if (target.id === 'bio-upvote-btn' || target.id === 'bio-downvote-btn' || target.id === 'mobile-upvote-btn' || target.id === 'mobile-downvote-btn') {
                return;
            }
            window.playClickSound();
        }
    });

    const enterBtn = document.getElementById("enter-btn");
    const enterOverlay = document.getElementById("enter-overlay");
    const playPauseBtn = document.getElementById("player-play-pause");
    const volumeSlider = document.getElementById("volume-slider");
    const visualizer = document.querySelector(".visualizer");

    const bgAudio = document.getElementById("bg-audio");
    const youtubePlayer = document.getElementById("youtube-player");
    const youtubeVideoId = "X4VbdwhkE10";
    let audioSource = null;

    async function fetchWithTimeout(url, options = {}, timeout = 2500) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    }

    async function loadYouTubeStream() {
        if (bgAudio) {
            bgAudio.crossOrigin = "anonymous";
            bgAudio.volume = volumeSlider ? parseFloat(volumeSlider.value) : 0.2;
            bgAudio.autoplay = false;

            // Try active Piped instances sequentially until one succeeds
            const PIPED_INSTANCES = [
                "https://pipedapi.kavin.rocks",
                "https://pipedapi-libre.kavin.rocks",
                "https://pipedapi.nosebs.ru",
                "https://piped-api.privacy.com.de",
                "https://api.piped.yt",
                "https://pipedapi.drgns.space",
                "https://pipedapi.ducks.party",
                "https://piped-api.codespace.cz",
                "https://pipedapi.reallyaweso.me",
                "https://api.piped.private.coffee",
                "https://pipedapi.darkness.services"
            ];

            let success = false;
            for (const instance of PIPED_INSTANCES) {
                try {
                    console.log("Trying Piped instance:", instance);
                    const r = await fetchWithTimeout(`${instance}/streams/${youtubeVideoId}`, {}, 2500);
                    if (r.ok) {
                        const data = await r.json();
                        if (data && data.audioStreams && data.audioStreams.length > 0) {
                            const audioUrl = data.audioStreams[0].url;
                            bgAudio.src = audioUrl;
                            audioSource = audioUrl;
                            console.log("Audio URL set successfully from Piped:", instance);
                            success = true;
                            break;
                        }
                    }
                } catch (err) {
                    console.log(`Piped API failed for ${instance}:`, err.message);
                }
            }

            if (!success) {
                console.log("All Piped API instances failed. Using direct YouTube embed fallback only.");
            }
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

                if (volumeSlider) {
                    bgAudio.volume = parseFloat(volumeSlider.value);
                }

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
            bgAudio.volume = value; // Direct binding to allow complete muting
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
    initControls();
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
        volumeSlider.value = 0.2;
        volumeSlider.addEventListener("input", (e) => {
            setBackgroundVolume(e.target.value);
        });
    }

    // Minimize player handler
    const minimizeBtn = document.getElementById("player-minimize-btn");
    const playerWidget = document.getElementById("music-player-widget");
    if (minimizeBtn && playerWidget) {
        minimizeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            playerWidget.classList.toggle("minimized");
            minimizeBtn.innerText = playerWidget.classList.contains("minimized") ? "🎵" : "×";
        });
        playerWidget.addEventListener("click", () => {
            if (playerWidget.classList.contains("minimized")) {
                playerWidget.classList.remove("minimized");
                minimizeBtn.innerText = "×";
            }
        });
    }

    function toggleVisualizer(play) {
        const bars = visualizer.querySelectorAll(".bar");
        bars.forEach(bar => {
            bar.style.animationPlayState = play ? "running" : "paused";
        });
    }
}



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

    let serverStatsMap = {};

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

    // Listen to Firebase stats path for real-time scores/votes
    onValue(ref(db, "stats"), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            serverStatsMap = data;
        } else {
            serverStatsMap = {};
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
            const stats = serverStatsMap[sIdUpper] || {};
            const score = stats.score || 0;
            const views = stats.views || 0;
            const isSpecial = sData.special === true || sData.is_special === true || sData.rank === 'median' || sData.rank === 'special' || (sData.admin_rank && sData.admin_rank.toLowerCase().includes('median')) || sData.submitted_by_median === true || isFav;

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
                description: sData.description || "No portal description provided.",
                is_favorite: isFav,
                is_verified: isFav,
                is_foreign: !isFav,
                is_registered: true,
                is_special: isSpecial,
                score: score,
                views: views,
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
                const stats = serverStatsMap[sId] || {};
                const score = stats.score || 0;
                const views = stats.views || 0;
                const isSpecial = sData.special === true || sData.is_special === true || sData.rank === 'median' || sData.rank === 'special' || (sData.admin_rank && sData.admin_rank.toLowerCase().includes('median')) || sData.submitted_by_median === true || isFav;

                tempServers.push({
                    server_id: sId,
                    name: sData.server_name || "MultiCraft Server",
                    admin: sData.admin_name || "Unknown",
                    players: `${sData.connected_players || 0}/${sData.max_players || 50}`,
                    player_val: parseInt(sData.connected_players || 0, 10),
                    pvp: sData.pvp !== false,
                    online: true,
                    description: desc || "No portal description provided.",
                    is_favorite: isFav,
                    is_verified: isFav,
                    is_foreign: !isFav,
                    is_registered: false,
                    is_special: isSpecial,
                    score: score,
                    views: views,
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

                const stats = serverStatsMap[fId] || {};
                const score = stats.score || 0;
                const views = stats.views || 0;

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
                    is_verified: true,
                    is_foreign: false,
                    is_registered: true,
                    is_special: true,
                    score: score,
                    views: views,
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
        document.getElementById("lobby-counter").innerText = `${totalPlayers} PLAYERS ONLINE ACROSS ALL PORTALS`;

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
            const response = await fetch(API_BASE_URL, {
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
                            description: desc || "No portal description provided.",
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
            const slug = getServerSlug(server);
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
    if (!container) return;
    container.innerHTML = "";

    // 1. Filter by search
    let filtered = servers.filter(s => {
        return s.name.toLowerCase().includes(searchVal) || s.server_id.toLowerCase().includes(searchVal);
    });

    // 2. Filter by currentFilter
    if (currentFilter === "FOREIGN") {
        filtered = filtered.filter(s => s.is_registered === false);
    } else if (currentFilter === "PREMIUM") {
        filtered = filtered.filter(s => s.premium === true);
    } else if (currentFilter === "SPECIAL") {
        filtered = filtered.filter(s => s.is_special === true);
    }

    // 3. Sort by currentSort
    if (currentSort === "LIT") {
        // Favorites first, then online descending by player count, then offline
        filtered.sort((a, b) => {
            if (a.is_favorite && !b.is_favorite) return -1;
            if (!a.is_favorite && b.is_favorite) return 1;
            if (a.online && !b.online) return -1;
            if (!a.online && b.online) return 1;
            return b.player_val - a.player_val;
        });
    } else if (currentSort === "UPVOTED") {
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (currentSort === "NEWEST") {
        // prioritize registered, sort by registered date (newest registered servers first)
        filtered.sort((a, b) => {
            if (a.is_registered && !b.is_registered) return -1;
            if (!a.is_registered && b.is_registered) return 1;
            const timeA = a.created_at || a.server_id || "";
            const timeB = b.created_at || b.server_id || "";
            return timeB.localeCompare(timeA);
        });
    }

    document.getElementById("lobby-counter").innerText = `Showing ${filtered.length} Live Portals`;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="no-results" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary)">No lobbies matching active filters found</div>`;
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
            const slug = getServerSlug(server);
            window.history.pushState({}, '', '/beta/' + slug);
            checkRoute(allServers);
        });

        const badgeHtml = server.is_verified
            ? `<span class="verified-badge" style="background: rgba(0, 240, 255, 0.15); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">Verified</span>`
            : `<span class="foreign-badge" style="background: rgba(255, 20, 147, 0.15); border: 1px solid var(--accent-pink); color: var(--accent-pink); font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">Foreign</span>`;

        card.innerHTML = `
            <div>
                <div class="server-header">
                    <h4 class="server-name" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>${server.name}</span>
                        ${badgeHtml}
                    </h4>
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
        document.getElementById("about-page-container").classList.add("hidden");
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
        renderMakersList();
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
        const slug = getServerSlug(s);
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
        document.getElementById("about-page-container").classList.add("hidden");
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

        // Render CTA for Foreign Server
        const foreignCtaEl = document.getElementById("bio-foreign-cta");
        if (foreignCtaEl) {
            if (matched.is_foreign) {
                foreignCtaEl.classList.remove("hidden");
            } else {
                foreignCtaEl.classList.add("hidden");
            }
        }

        // Render SPECIAL server gallery
        const gallerySection = document.getElementById("bio-gallery-section");
        if (gallerySection) {
            if (matched.is_special && matched.is_registered) {
                gallerySection.classList.remove("hidden");
                const imgs = gallerySection.querySelectorAll(".gallery-img");
                const galleryUrls = matched.gallery || [
                    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80",
                    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80",
                    "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80",
                    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80"
                ];
                imgs.forEach((img, idx) => {
                    img.src = galleryUrls[idx] || galleryUrls[0];
                });
            } else {
                gallerySection.classList.add("hidden");
            }
        }

        // Hide desktop voting container if server is not registered
        const desktopVoteContainer = document.querySelector(".bio-stats-bar .vote-container");
        if (desktopVoteContainer) {
            desktopVoteContainer.style.display = matched.is_registered !== false ? "flex" : "none";
        }

        startBioTypewriter(matched.description);

        const serverId = matched.server_id;
        const statsViewsRef = ref(db, `stats/${serverId}/views`);
        const statsScoreRef = ref(db, `stats/${serverId}/score`);

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

        onValue(statsScoreRef, (snapshot) => {
            const scoreVal = snapshot.val() || 0;
            const scoreCountEl = document.getElementById("bio-score-count");
            if (scoreCountEl) {
                scoreCountEl.innerText = scoreVal.toLocaleString();
            }
        }, (error) => {
            console.error("Failed to load score: ", error);
        });

        const bioUpvoteBtn = document.getElementById("bio-upvote-btn");
        const bioDownvoteBtn = document.getElementById("bio-downvote-btn");
        const bioScoreCount = document.getElementById("bio-score-count");

        function updateDesktopVoteUI() {
            if (!bioUpvoteBtn || !bioDownvoteBtn || !bioScoreCount) return;
            const vote = localStorage.getItem(`area12_vote_${serverId}`);
            bioUpvoteBtn.classList.remove("active");
            bioDownvoteBtn.classList.remove("active");
            bioScoreCount.classList.remove("upvoted", "downvoted");
            if (vote === "upvoted") {
                bioUpvoteBtn.classList.add("active");
                bioScoreCount.classList.add("upvoted");
            } else if (vote === "downvoted") {
                bioDownvoteBtn.classList.add("active");
                bioScoreCount.classList.add("downvoted");
            }
        }

        updateDesktopVoteUI();

        if (bioUpvoteBtn) {
            bioUpvoteBtn.onclick = () => {
                if (activeVoteRequests.has(serverId)) return;
                activeVoteRequests.add(serverId);

                const currentVote = localStorage.getItem(`area12_vote_${serverId}`);
                let scoreDiff = 0;
                let newVote = null;

                if (currentVote === "upvoted") {
                    scoreDiff = -1;
                    newVote = null;
                    window.playDownvoteSound();
                } else if (currentVote === "downvoted") {
                    scoreDiff = 2;
                    newVote = "upvoted";
                    window.playUpvoteSound();
                } else {
                    scoreDiff = 1;
                    newVote = "upvoted";
                    window.playUpvoteSound();
                }

                runTransaction(statsScoreRef, (currentScore) => {
                    return (currentScore || 0) + scoreDiff;
                }).then((result) => {
                    if (result.committed) {
                        if (newVote) {
                            localStorage.setItem(`area12_vote_${serverId}`, newVote);
                        } else {
                            localStorage.removeItem(`area12_vote_${serverId}`);
                        }
                        updateDesktopVoteUI();
                        showToast(scoreDiff > 0 ? "Upvoted! ▲" : "Upvote retracted");
                    }
                }).catch(err => {
                    console.error("Vote error: ", err);
                }).finally(() => {
                    activeVoteRequests.delete(serverId);
                });
            };
        }

        if (bioDownvoteBtn) {
            bioDownvoteBtn.onclick = () => {
                if (activeVoteRequests.has(serverId)) return;
                activeVoteRequests.add(serverId);

                const currentVote = localStorage.getItem(`area12_vote_${serverId}`);
                let scoreDiff = 0;
                let newVote = null;

                if (currentVote === "downvoted") {
                    scoreDiff = 1;
                    newVote = null;
                    window.playUpvoteSound();
                } else if (currentVote === "upvoted") {
                    scoreDiff = -2;
                    newVote = "downvoted";
                    window.playDownvoteSound();
                } else {
                    scoreDiff = -1;
                    newVote = "downvoted";
                    window.playDownvoteSound();
                }

                runTransaction(statsScoreRef, (currentScore) => {
                    return (currentScore || 0) + scoreDiff;
                }).then((result) => {
                    if (result.committed) {
                        if (newVote) {
                            localStorage.setItem(`area12_vote_${serverId}`, newVote);
                        } else {
                            localStorage.removeItem(`area12_vote_${serverId}`);
                        }
                        updateDesktopVoteUI();
                        showToast(scoreDiff < 0 ? "Downvoted! ▼" : "Downvote retracted");
                    }
                }).catch(err => {
                    console.error("Vote error: ", err);
                }).finally(() => {
                    activeVoteRequests.delete(serverId);
                });
            };
        }

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

    const makerModal = document.getElementById("maker-profile-modal");
    const closeMakerBtn = document.getElementById("close-maker-modal");
    const makerOverlay = document.getElementById("maker-modal-overlay");

    if (closeMakerBtn && makerModal) {
        closeMakerBtn.addEventListener("click", () => {
            makerModal.classList.add("hidden");
        });
    }
    if (makerOverlay && makerModal) {
        makerOverlay.addEventListener("click", () => {
            makerModal.classList.add("hidden");
        });
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
            document.body.classList.add("chat-active");
            setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 100);
        } else {
            document.body.classList.remove("chat-active");
        }
    });

    chatCloseBtn.addEventListener("click", () => {
        isChatOpen = false;
        chatBox.classList.add("hidden");
        document.body.classList.remove("chat-active");
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

            const userVote = localStorage.getItem(`comment_vote_${comment.id}`);
            const upActive = userVote === 'upvoted' ? 'active' : '';
            const downActive = userVote === 'downvoted' ? 'active' : '';
            const scoreClass = userVote === 'upvoted' ? 'upvoted' : (userVote === 'downvoted' ? 'downvoted' : '');

            item.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.username.toUpperCase()}</span>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
                <div class="comment-footer">
                    <div class="vote-container" style="padding: 0px 4px; border-radius: 8px; gap: 2px;">
                        <button class="vote-btn comment-upvote-btn upvote ${upActive}" data-id="${comment.id}" style="font-size: 0.9rem; padding: 4px 6px;">▲</button>
                        <span class="score-count comment-score-count ${scoreClass}" data-id="${comment.id}" style="font-size: 0.75rem; min-width: 16px;">${comment.score || 0}</span>
                        <button class="vote-btn comment-downvote-btn downvote ${downActive}" data-id="${comment.id}" style="font-size: 0.9rem; padding: 4px 6px;">▼</button>
                    </div>
                </div>
            `;

            const likeBtn = item.querySelector(".comment-upvote-btn");
            const dislikeBtn = item.querySelector(".comment-downvote-btn");

            likeBtn.onclick = () => voteComment(serverId, comment.id, 'upvote');
            dislikeBtn.onclick = () => voteComment(serverId, comment.id, 'downvote');

            commentsContainer.appendChild(item);
        });
    }, (error) => {
        console.error("Comments fetch error: ", error);
        commentsContainer.innerHTML = `<p class="no-comments-msg" style="color: var(--accent-pink);">Failed to load comments (Permission Denied). Please verify your Firebase Database Rules allow public read access.</p>`;
    });
}

function voteComment(serverId, commentId, action) {
    if (activeVoteRequests.has(commentId)) return;
    activeVoteRequests.add(commentId);

    const voteKey = `comment_vote_${commentId}`;
    const currentVote = localStorage.getItem(voteKey);
    let scoreDiff = 0;
    let newVote = null;

    if (action === 'upvote') {
        if (currentVote === 'upvoted') {
            scoreDiff = -1;
            newVote = null;
            window.playDownvoteSound();
        } else if (currentVote === 'downvoted') {
            scoreDiff = 2;
            newVote = 'upvoted';
            window.playUpvoteSound();
        } else {
            scoreDiff = 1;
            newVote = 'upvoted';
            window.playUpvoteSound();
        }
    } else if (action === 'downvote') {
        if (currentVote === 'downvoted') {
            scoreDiff = 1;
            newVote = null;
            window.playUpvoteSound();
        } else if (currentVote === 'upvoted') {
            scoreDiff = -2;
            newVote = 'downvoted';
            window.playDownvoteSound();
        } else {
            scoreDiff = -1;
            newVote = 'downvoted';
            window.playDownvoteSound();
        }
    }

    const scoreRef = ref(db, `server_comments/${serverId}/${commentId}/score`);
    runTransaction(scoreRef, (curr) => {
        return (curr || 0) + scoreDiff;
    }).then((result) => {
        if (result.committed) {
            if (newVote) {
                localStorage.setItem(voteKey, newVote);
            } else {
                localStorage.removeItem(voteKey);
            }
        }
    }).catch(err => {
        console.error("Voting error: ", err);
    }).finally(() => {
        activeVoteRequests.delete(commentId);
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
    const MOBILE_FILTERS = ["ALL", "FOREIGN", "PREMIUM", "SPECIAL"];

    const updateFilterUI = (newFilter) => {
        mobileCurrentFilter = newFilter;
        currentFilter = newFilter; // Sync with desktop
        mobileActiveIndex = 0;

        // Highlight active filter button in drawer
        const filterBtns = document.querySelectorAll(".mobile-filter-box .filter-btn");
        filterBtns.forEach(btn => {
            if (btn.dataset.filter === mobileCurrentFilter) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        // Also sync desktop filter active state
        const desktopBtn = document.querySelector(`.filter-controls .filter-btn[data-filter="${newFilter}"]`);
        if (desktopBtn) {
            document.querySelectorAll(".filter-controls .filter-btn").forEach(b => b.classList.remove("active"));
            desktopBtn.classList.add("active");
        }

        window.renderMobileUI();
        renderDirectoryGrid(allServers);
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

    // Close sidebar drawer when filters or sorts are selected
    document.querySelectorAll(".sidebar-filters .filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
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

    const mobileMakersLink = document.querySelector(".sidebar-nav [data-target='makers']");
    if (mobileMakersLink) {
        mobileMakersLink.addEventListener("click", (e) => {
            e.preventDefault();
            window.history.pushState({}, '', '/beta/credits');
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
    if (mobileCurrentFilter === "FOREIGN") {
        filtered = filtered.filter(s => s.is_registered === false);
    } else if (mobileCurrentFilter === "PREMIUM") {
        filtered = filtered.filter(s => s.premium === true);
    } else if (mobileCurrentFilter === "SPECIAL") {
        filtered = filtered.filter(s => s.is_special === true);
    }

    // Apply Sorting
    if (currentSort === "LIT") {
        filtered.sort((a, b) => {
            if (a.is_favorite && !b.is_favorite) return -1;
            if (!a.is_favorite && b.is_favorite) return 1;
            if (a.online && !b.online) return -1;
            if (!a.online && b.online) return 1;
            return b.player_val - a.player_val;
        });
    } else if (currentSort === "UPVOTED") {
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (currentSort === "NEWEST") {
        filtered.sort((a, b) => {
            if (a.is_registered && !b.is_registered) return -1;
            if (!a.is_registered && b.is_registered) return 1;
            const timeA = a.created_at || a.server_id || "";
            const timeB = b.created_at || b.server_id || "";
            return timeB.localeCompare(timeA);
        });
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

    const mobileBadgeHtml = server.is_verified
        ? `<span style="background: rgba(0, 240, 255, 0.15); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 6px; text-transform: uppercase;">Verified</span>`
        : `<span style="background: rgba(255, 20, 147, 0.15); border: 1px solid var(--accent-pink); color: var(--accent-pink); font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 6px; text-transform: uppercase;">Foreign</span>`;

    const voteContainerHtml = server.is_registered !== false ? `
        <div class="vote-container" style="padding: 0px 4px; border-radius: 8px; gap: 2px;">
            <button id="mobile-upvote-btn" class="vote-btn upvote" style="font-size: 0.9rem; padding: 4px 6px;">▲</button>
            <span id="mobile-score-count" class="score-count" style="font-size: 0.75rem; min-width: 16px;">0</span>
            <button id="mobile-downvote-btn" class="vote-btn downvote" style="font-size: 0.9rem; padding: 4px 6px;">▼</button>
        </div>
    ` : '';

    // Update active card HTML
    mobileActiveCard.innerHTML = `
        <div class="card-top">
            <h2 class="card-server-name" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                <span>${server.name}</span>
                ${server.is_favorite ? '<span class="star">★</span>' : ''}
                ${mobileBadgeHtml}
            </h2>
            <p class="card-server-maker">${server.admin}</p>
        </div>
        <div class="card-meta">
            <span class="card-invite-code" id="mobile-invite-code-btn">${server.server_id}</span>
            <div class="card-stats">
                ${voteContainerHtml}
                <button style="background:transparent; border:none; color:var(--text-secondary); display:flex; align-items:center; gap:2px; font-size:0.8rem;">
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

    // Set up Views & Score stats listeners
    const viewsRef = ref(db, `stats/${server.server_id}/views`);
    const scoreRef = ref(db, `stats/${server.server_id}/score`);

    onValue(viewsRef, (snap) => {
        const val = snap.val() || 0;
        const el = document.getElementById("mobile-views-count");
        if (el) el.innerText = val.toLocaleString();
    }, (err) => console.error(err));

    onValue(scoreRef, (snap) => {
        const val = snap.val() || 0;
        const el = document.getElementById("mobile-score-count");
        if (el) el.innerText = val.toLocaleString();
    }, (err) => console.error(err));

    const mobileUpvoteBtn = document.getElementById("mobile-upvote-btn");
    const mobileDownvoteBtn = document.getElementById("mobile-downvote-btn");
    const mobileScoreCount = document.getElementById("mobile-score-count");

    function updateMobileVoteUI() {
        if (!mobileUpvoteBtn || !mobileDownvoteBtn || !mobileScoreCount) return;
        const vote = localStorage.getItem(`area12_vote_${server.server_id}`);
        mobileUpvoteBtn.classList.remove("active");
        mobileDownvoteBtn.classList.remove("active");
        mobileScoreCount.classList.remove("upvoted", "downvoted");
        if (vote === "upvoted") {
            mobileUpvoteBtn.classList.add("active");
            mobileScoreCount.classList.add("upvoted");
        } else if (vote === "downvoted") {
            mobileDownvoteBtn.classList.add("active");
            mobileScoreCount.classList.add("downvoted");
        }
    }

    updateMobileVoteUI();

    if (mobileUpvoteBtn) {
        mobileUpvoteBtn.addEventListener("click", () => {
            if (activeVoteRequests.has(server.server_id)) return;
            activeVoteRequests.add(server.server_id);

            const currentVote = localStorage.getItem(`area12_vote_${server.server_id}`);
            let scoreDiff = 0;
            let newVote = null;

            if (currentVote === "upvoted") {
                scoreDiff = -1;
                newVote = null;
                window.playDownvoteSound();
            } else if (currentVote === "downvoted") {
                scoreDiff = 2;
                newVote = "upvoted";
                window.playUpvoteSound();
            } else {
                scoreDiff = 1;
                newVote = "upvoted";
                window.playUpvoteSound();
            }

            runTransaction(scoreRef, (curr) => (curr || 0) + scoreDiff).then((res) => {
                if (res.committed) {
                    if (newVote) {
                        localStorage.setItem(`area12_vote_${server.server_id}`, newVote);
                    } else {
                        localStorage.removeItem(`area12_vote_${server.server_id}`);
                    }
                    updateMobileVoteUI();
                    showToast(scoreDiff > 0 ? "Upvoted! ▲" : "Upvote retracted");
                }
            }).catch(err => console.error(err))
                .finally(() => {
                    activeVoteRequests.delete(server.server_id);
                });
        });
    }

    if (mobileDownvoteBtn) {
        mobileDownvoteBtn.addEventListener("click", () => {
            if (activeVoteRequests.has(server.server_id)) return;
            activeVoteRequests.add(server.server_id);

            const currentVote = localStorage.getItem(`area12_vote_${server.server_id}`);
            let scoreDiff = 0;
            let newVote = null;

            if (currentVote === "downvoted") {
                scoreDiff = 1;
                newVote = null;
                window.playUpvoteSound();
            } else if (currentVote === "upvoted") {
                scoreDiff = -2;
                newVote = "downvoted";
                window.playDownvoteSound();
            } else {
                scoreDiff = -1;
                newVote = "downvoted";
                window.playDownvoteSound();
            }

            runTransaction(scoreRef, (curr) => (curr || 0) + scoreDiff).then((res) => {
                if (res.committed) {
                    if (newVote) {
                        localStorage.setItem(`area12_vote_${server.server_id}`, newVote);
                    } else {
                        localStorage.removeItem(`area12_vote_${server.server_id}`);
                    }
                    updateMobileVoteUI();
                    showToast(scoreDiff < 0 ? "Downvoted! ▼" : "Downvote retracted");
                }
            }).catch(err => console.error(err))
                .finally(() => {
                    activeVoteRequests.delete(server.server_id);
                });
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
        let detailsHtml = `<p style="margin-bottom: 12px;">${server.description || "No description provided for this server."}</p>`;
        if (server.is_foreign) {
            detailsHtml += `
                <div class="bio-foreign-cta" style="margin-top: 16px;">
                    <div class="cta-title">Do you own this server?</div>
                    <div class="cta-text">Get your own custom invite link and get verified on area12.lol, just join our Discord and open a ticket!</div>
                    <a href="https://discord.gg/v9NUPx3p78" target="_blank" class="cta-btn">Join Discord & Verify</a>
                </div>
            `;
        }
        if (server.is_special && server.is_registered) {
            const galleryUrls = server.gallery || [
                "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80",
                "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80",
                "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80",
                "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80"
            ];
            detailsHtml += `
                <div class="bio-gallery-section" style="border:none; padding:0; margin-top:20px;">
                    <div class="gallery-title" style="font-size:0.85rem; margin-bottom:8px;">PORTAL GALLERY</div>
                    <div class="gallery-grid" style="grid-template-columns: repeat(2, 1fr); gap: 8px;">
                        <img src="${galleryUrls[0]}" class="gallery-img" style="border-radius:6px;" alt="Pic 1">
                        <img src="${galleryUrls[1]}" class="gallery-img" style="border-radius:6px;" alt="Pic 2">
                        <img src="${galleryUrls[2]}" class="gallery-img" style="border-radius:6px;" alt="Pic 3">
                        <img src="${galleryUrls[3]}" class="gallery-img" style="border-radius:6px;" alt="Pic 4">
                    </div>
                </div>
            `;
        }
        descPanel.innerHTML = detailsHtml;
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
        const slug = getServerSlug(s);
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

            const userVote = localStorage.getItem(`comment_vote_${comment.id}`);
            const upActive = userVote === 'upvoted' ? 'active' : '';
            const downActive = userVote === 'downvoted' ? 'active' : '';
            const scoreClass = userVote === 'upvoted' ? 'upvoted' : (userVote === 'downvoted' ? 'downvoted' : '');

            item.innerHTML = `
                <div class="comment-header" style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 6px;">
                    <span class="comment-author" style="font-weight: 800; color: var(--accent-cyan);">${comment.username.toUpperCase()}</span>
                    <span class="comment-date" style="color: var(--text-secondary); opacity: 0.7;">${date}</span>
                </div>
                <div class="comment-text" style="font-size: 0.85rem; line-height: 1.4; word-break: break-word; margin-bottom: 8px;">${escapeHtml(comment.text)}</div>
                <div class="comment-footer" style="display: flex; justify-content: flex-start; gap: 8px;">
                    <div class="vote-container" style="padding: 0px 4px; border-radius: 8px; gap: 2px;">
                        <button class="vote-btn comment-upvote-btn upvote ${upActive}" data-id="${comment.id}" style="font-size: 0.9rem; padding: 4px 6px;">▲</button>
                        <span class="score-count comment-score-count ${scoreClass}" data-id="${comment.id}" style="font-size: 0.75rem; min-width: 16px;">${comment.score || 0}</span>
                        <button class="vote-btn comment-downvote-btn downvote ${downActive}" data-id="${comment.id}" style="font-size: 0.9rem; padding: 4px 6px;">▼</button>
                    </div>
                </div>
            `;

            const likeBtn = item.querySelector(".comment-upvote-btn");
            const dislikeBtn = item.querySelector(".comment-downvote-btn");

            likeBtn.onclick = () => voteComment(serverId, comment.id, 'upvote');
            dislikeBtn.onclick = () => voteComment(serverId, comment.id, 'downvote');

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

// 32. Dynamic Makers / Credits rendering
function renderMakersList() {
    const container = document.getElementById("makers-list-container");
    if (!container) return;

    // Clear previous
    container.innerHTML = "";

    // Render cards
    MAKERS_DATA.forEach(maker => {
        const card = document.createElement("div");
        card.className = "maker-card";
        if (maker.pinned) {
            card.classList.add("pinned-maker");
        }

        // Use relative path to assets folder
        const bannerPath = BASE_PATH + `assets/${maker.image}`;

        card.innerHTML = `
            <div class="maker-card-banner" style="background-image: url('${bannerPath}')"></div>
            <div class="maker-card-avatar-wrap">
                <div class="maker-card-avatar">${maker.displayName[0].toUpperCase()}</div>
            </div>
            <div class="maker-card-info">
                <div>
                    <h3 class="maker-card-name">${maker.displayName}</h3>
                    <p class="maker-card-role">${maker.role}</p>
                </div>
                <button class="maker-card-action">View Profile</button>
            </div>
        `;

        card.addEventListener("click", () => {
            openMakerProfileModal(maker);
        });

        container.appendChild(card);
    });
}

function openMakerProfileModal(maker) {
    const modal = document.getElementById("maker-profile-modal");
    if (!modal) return;

    // Populate data
    document.getElementById("maker-modal-banner").style.backgroundImage = `url('${BASE_PATH}assets/${maker.image}')`;
    document.getElementById("maker-modal-avatar").innerText = maker.displayName[0].toUpperCase();
    document.getElementById("maker-modal-name").innerText = maker.displayName;
    document.getElementById("maker-modal-role").innerText = maker.role;
    document.getElementById("maker-modal-bio").innerText = maker.bio || "No biography provided.";

    // Discord Button
    const discordBtn = document.getElementById("maker-modal-discord");
    const discordText = document.getElementById("maker-modal-discord-text");
    if (maker.discord) {
        discordBtn.style.display = "inline-flex";
        discordText.innerText = maker.discord;

        // Copy to clipboard or alert on click
        discordBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(maker.discord);
            showToast(`Discord tag "${maker.discord}" copied to clipboard!`);
        };
    } else {
        discordBtn.style.display = "none";
    }

    // Portals / Servers Created
    const serversListContainer = document.getElementById("maker-modal-servers");
    serversListContainer.innerHTML = "";

    // Find servers made by this user in allServers
    // We match if the maker's username is in server.admin
    const matchedServers = allServers.filter(s => {
        if (!s.admin) return false;
        // Split server admins by comma/spaces and match
        const adminsList = s.admin.split(/[,&/]/).map(a => a.trim().toLowerCase());
        return adminsList.includes(maker.username.toLowerCase()) ||
            s.admin.toLowerCase().includes(maker.username.toLowerCase());
    });

    if (matchedServers.length > 0) {
        matchedServers.forEach(server => {
            const tag = document.createElement("a");
            tag.className = "maker-server-tag";
            tag.innerText = server.name;
            tag.addEventListener("click", (e) => {
                e.preventDefault();
                // Close modal
                modal.classList.add("hidden");
                // Navigate to server profile/bio!
                const serverSlug = getServerSlug(server);
                window.history.pushState({}, '', `/beta/${serverSlug}`);
                checkRoute(allServers);
            });
            serversListContainer.appendChild(tag);
        });
    } else {
        const fallback = document.createElement("span");
        fallback.className = "maker-no-servers";
        fallback.innerText = "No registered portals found for this maker.";
        serversListContainer.appendChild(fallback);
    }

    // Show modal
    modal.classList.remove("hidden");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBetaApp);
} else {
    initBetaApp();
}

