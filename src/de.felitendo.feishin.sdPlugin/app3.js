/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />


const CONFIG = {
    FEISHIN_WS_URL: 'ws://NUC-01.local:4333', // Default URL, make this configurable
    RECONNECT_DELAY: 5000, // Delay before attempting to reconnect
    VOLUME_STEP: 10, // Volume step for increase/decrease
    MAX_VOLUME: 100, // Maximum volume
    MIN_VOLUME: 0 // Minimum volume
};

let feishinWs = null;
let currentPlaybackStatus = 'PAUSED'; // Default to paused
let currentVolume = 50; // Default volume, you can adjust this as needed

const EVENTS = {
    AUTHENTICATE: 'authenticate',
    STATE: 'state',
    PLAYBACK: 'playback',
    SHUFFLE: 'shuffle',
    REPEAT: 'repeat',
    VOLUME: 'volume',
    NEXT: 'next',
    PREVIOUS: 'previous',
    PLAY: 'play',
    PAUSE: 'pause'
};

if (typeof Action === 'undefined') {
    console.error('Action class is not defined. Please ensure it is imported correctly.');
} else {
    const playPauseAction = new Action('de.felitendo.feishin.playpause');
    const nextAction = new Action('de.felitendo.feishin.next');
    const previousAction = new Action('de.felitendo.feishin.previous');
    const shuffleAction = new Action('de.felitendo.feishin.shuffle');
    const repeatAction = new Action('de.felitendo.feishin.repeat');
    const volumeUpAction = new Action('de.felitendo.feishin.volumeup');
    const volumeDownAction = new Action('de.felitendo.feishin.volumedown');

    /**
     * The first event fired when Stream Deck starts
     */
    $SD.onConnected(({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
        console.log('Stream Deck connected!');
        connectToFeishin();
    });

    function connectToFeishin() {
        feishinWs = new WebSocket(CONFIG.FEISHIN_WS_URL);

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
            setTimeout(connectToFeishin, CONFIG.RECONNECT_DELAY);
        };
    }

    function authenticate(username, password) {
        const auth = btoa(`${username}:${password}`);
        sendMessage({
            event: EVENTS.AUTHENTICATE,
            header: `Basic ${auth}`
        });
    }

    function handleFeishinMessage(data) {
        console.log('Received message from Feishin:', data);
        switch(data.event) {
            case EVENTS.STATE:
                updateAllButtons(data.data);
                break;
            case EVENTS.PLAYBACK:
                updatePlayPauseButton(data.data.status);
                break;
            case EVENTS.SHUFFLE:
                updateShuffleButton(data.data.shuffle);
                break;
            case EVENTS.REPEAT:
                updateRepeatButton(data.data.repeat);
                break;
            case EVENTS.VOLUME:
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

    function sendMessage(message) {
        if (feishinWs && feishinWs.readyState === WebSocket.OPEN) {
            feishinWs.send(JSON.stringify(message));
            console.log('Sent message to Feishin:', message);
        } else {
            console.error('WebSocket is not open. Unable to send message:', message);
        }
    }

    playPauseAction.onKeyUp(({ action, context, device, event, payload }) => {
        const command = currentPlaybackStatus === 'PLAYING' ? EVENTS.PAUSE : EVENTS.PLAY;
        sendMessage({ event: command });
        
        // Temporarily update the button state
        updatePlayPauseButton(command === EVENTS.PLAY ? 'PLAYING' : 'PAUSED');
    });

    nextAction.onKeyUp(({ action, context, device, event, payload }) => {
        sendMessage({ event: EVENTS.NEXT });
    });

    previousAction.onKeyUp(({ action, context, device, event, payload }) => {
        sendMessage({ event: EVENTS.PREVIOUS });
    });

    shuffleAction.onKeyUp(({ action, context, device, event, payload }) => {
        sendMessage({ event: EVENTS.SHUFFLE });
    });

    repeatAction.onKeyUp(({ action, context, device, event, payload }) => {
        sendMessage({ event: EVENTS.REPEAT });
    });

    volumeUpAction.onKeyUp(({ action, context, device, event, payload }) => {
        currentVolume = Math.min(CONFIG.MAX_VOLUME, currentVolume + CONFIG.VOLUME_STEP); // Increase volume by step, max volume
        sendMessage({ event: EVENTS.VOLUME, volume: currentVolume });
    });

    volumeDownAction.onKeyUp(({ action, context, device, event, payload }) => {
        currentVolume = Math.max(CONFIG.MIN_VOLUME, currentVolume - CONFIG.VOLUME_STEP); // Decrease volume by step, min volume
        sendMessage({ event: EVENTS.VOLUME, volume: currentVolume });
    });
}