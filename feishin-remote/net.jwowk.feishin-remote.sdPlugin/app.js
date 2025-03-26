/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const FEISHIN_WS_URL = 'ws://NUC-01.local:4333'; // Default URL, make this configurable
let feishinWs = null;
let currentPlaybackStatus = 'PAUSED'; // Default to paused
let currentVolume = 50; // Default volume, you can adjust this as needed

if (typeof Action === 'undefined') {
    console.error('Action class is not defined. Please ensure it is imported correctly.');
} else {
    var playPauseAction = new Action('net.jwowk.feishin-remote.sdPlugin.playpause');
    var nextAction = new Action('net.jwowk.feishin-remote.sdPlugin.next');
    var previousAction = new Action('net.jwowk.feishin-remote.sdPlugin.previous');
    var shuffleAction = new Action('net.jwowk.feishin-remote.sdPlugin.shuffle');
    var repeatAction = new Action('net.jwowk.feishin-remote.sdPlugin.repeat');
    var volumeUpAction = new Action('net.jwowk.feishin-remote.sdPlugin.volumeup');
    var volumeDownAction = new Action('net.jwowk.feishin-remote.sdPlugin.volumedown');
}

/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
    console.log('Stream Deck connected!');
    connectToFeishin();
});

function connectToFeishin() {
    feishinWs = new WebSocket(FEISHIN_WS_URL);

    feishinWs.onopen = function() {
        console.log('Connected to Feishin');
        // Authenticate to Feishin Client
        authenticate('feishin', 'streamdeck');
    };

    feishinWs.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleFeishinMessage(data);
    };

    feishinWs.onerror = function(error) {
        console.error('Feishin WebSocket Error:', error);
    };

    feishinWs.onclose = function() {
        console.log('Disconnected from Feishin');
        // Attempt to reconnect after a delay
        setTimeout(connectToFeishin, 5000);
    };
}

function authenticate(username, password) {
    const auth = btoa(`${username}:${password}`);
    feishinWs.send(JSON.stringify({
        event: 'authenticate',
        header: `Basic ${auth}`
    }));
}

function handleFeishinMessage(data) {
    console.log('Received message from Feishin:', data);
    switch(data.event) {
        case 'state':
            updateAllButtons(data.data);
            break;
        case 'playback':
            updatePlayPauseButton(data.data.status);
            break;
        case 'shuffle':
            updateShuffleButton(data.data.shuffle);
            break;
        case 'repeat':
            updateRepeatButton(data.data.repeat);
            break;
        case 'volume':
            updateVolume(data.data.volume);
            break;
    }
}

function updateAllButtons(state) {
    updatePlayPauseButton(state.status);
    updateShuffleButton(state.shuffle);
    updateRepeatButton(state.repeat);
    updateVolume(state.volume);
}

function updateVolume(volume) {
    currentVolume = volume;
    console.log('Updated volume to:', currentVolume);
} 


function updatePlayPauseButton(status) {
    console.log('Updating play/pause button with status:', status);
    if (typeof status === 'string') {
        currentPlaybackStatus = status.toUpperCase();
    } else if (typeof status === 'boolean') {
        currentPlaybackStatus = status ? 'PLAYING' : 'PAUSED';
    } else {
        console.error('Unexpected status type:', typeof status);
        return;
    }
    
    const isPlaying = currentPlaybackStatus === 'PLAYING';
    playPauseAction.setImage(isPlaying ? 'images/pause.png' : 'images/play.png');
    console.log('Updated play/pause button. Current status:', currentPlaybackStatus);
}

function updateShuffleButton(shuffleState) {
    shuffleAction.setImage(shuffleState ? 'images/shuffle_on.png' : 'images/shuffle_off.png');
}

function updateRepeatButton(repeatState) {
    switch(repeatState) {
        case 'none':
            repeatAction.setImage('images/repeat_off.png');
            break;
        case 'all':
            repeatAction.setImage('images/repeat_all.png');
            break;
        case 'one':
            repeatAction.setImage('images/repeat_one.png');
            break;
    }
}

playPauseAction.onKeyUp(({ action, context, device, event, payload }) => {
    if (feishinWs && feishinWs.readyState === WebSocket.OPEN) {
        const command = currentPlaybackStatus === 'PLAYING' ? 'pause' : 'play';
        feishinWs.send(JSON.stringify({ event: command }));
        console.log('Sent command to Feishin:', command);
        
        // Temporarily update the button state
        updatePlayPauseButton(command === 'play' ? 'PLAYING' : 'PAUSED');
    }
});

nextAction.onKeyUp(({ action, context, device, event, payload }) => {
    if (feishinWs && feishinWs.readyState === WebSocket.OPEN) {
        feishinWs.send(JSON.stringify({ event: 'next' }));
    }
});

previousAction.onKeyUp(({ action, context, device, event, payload }) => {
    if (feishinWs && feishinWs.readyState === WebSocket.OPEN) {
        feishinWs.send(JSON.stringify({ event: 'previous' }));
    }
});

shuffleAction.onKeyUp(({ action, context, device, event, payload }) => {
    if (feishinWs && feishinWs.readyState === WebSocket.OPEN) {
        feishinWs.send(JSON.stringify({ event: 'shuffle' }));
    }
});

repeatAction.onKeyUp(({ action, context, device, event, payload }) => {
    if (feishinWs && feishinWs.readyState === WebSocket.OPEN) {
        feishinWs.send(JSON.stringify({ event: 'repeat' }));
    }
});

volumeUpAction.onKeyUp(({ action, context, device, event, payload }) => {
    if (feishinWs && feishinWs.readyState === WebSocket.OPEN) {
        currentVolume = Math.min(100, currentVolume + 10); // Increase volume by 10, max 100
        feishinWs.send(JSON.stringify({ event: 'volume', volume: currentVolume }));
        console.log('Increased volume to:', currentVolume);
    }
});

volumeDownAction.onKeyUp(({ action, context, device, event, payload }) => {
    if (feishinWs && feishinWs.readyState === WebSocket.OPEN) {
        currentVolume = Math.max(0, currentVolume - 10); // Decrease volume by 10, min 0
        feishinWs.send(JSON.stringify({ event: 'volume', volume: currentVolume }));
        console.log('Decreased volume to:', currentVolume);
    }
});