// Connection objects (will be provided either via opener or via initClassroom)
let peerConnection;
let dataChannel;
let localStream;

// DOM Elements
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const toggleVideoBtn = document.getElementById('toggle-video-btn');
const toggleAudioBtn = document.getElementById('toggle-audio-btn');
const screenShareBtn = document.getElementById('screen-share-btn');
const hangUpBtn = document.getElementById('hang-up-btn');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const chatMessages = document.getElementById('chat-messages');
const fileInput = document.getElementById('file-input');
const sendFileBtn = document.getElementById('send-file-btn');
const fileList = document.getElementById('file-list');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// ============================================
// INITIALIZATION
// ============================================
function initClassroom(pc, dc, stream) {
    console.log('Classroom initialized by parent window.');
    
    // Assign the received objects to the global variables
    peerConnection = pc;
    dataChannel = dc;
    localStream = stream;
    
    // Set up video if local stream exists
    if (localStream) {
        localVideo.srcObject = localStream;
    }
    
    // Set up remote video and data channel handlers
    if (peerConnection) {
        // It's crucial to RE-ASSIGN the handlers for this window's context
        peerConnection.ontrack = (event) => {
            console.log('Classroom received remote track');
            remoteVideo.srcObject = event.streams[0];
        };
    }
    
    if (dataChannel) {
        dataChannel.onmessage = handleDataChannelMessage;
    }
    
    appendSystemMessage('Welcome to the classroom!');
}

// ============================================
// TAB SWITCHING
// ============================================
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show target tab content
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `${targetTab}-tab`) {
                content.classList.add('active');
            }
        });
    });
});

// ============================================
// CAMERA CONTROLS
// ============================================
toggleVideoBtn.addEventListener('click', () => {
    if (!localStream) {
        startCamera();
    } else {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            toggleVideoBtn.classList.toggle('inactive');
            toggleVideoBtn.classList.toggle('active');
        }
    }
});

toggleAudioBtn.addEventListener('click', () => {
    if (!localStream) {
        startCamera();
    } else {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            toggleAudioBtn.classList.toggle('inactive');
            toggleAudioBtn.classList.toggle('active');
        }
    }
});

async function startCamera() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        localVideo.srcObject = localStream;
        
        // Add tracks to peer connection
        if (peerConnection) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
        
        // Update parent window's localStream
        if (window.opener) {
            window.opener.localStream = localStream;
        }
        
        appendSystemMessage('Camera and microphone activated');
    } catch (error) {
        console.error('Error accessing media:', error);
        alert('Could not access camera/microphone. Please check permissions.');
    }
}

// Screen sharing
screenShareBtn.addEventListener('click', async () => {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: true 
        });
        
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
            sender.replaceTrack(screenTrack);
        }
        
        screenTrack.onended = () => {
            // Restore camera when screen sharing stops
            if (localStream) {
                const cameraTrack = localStream.getVideoTracks()[0];
                sender.replaceTrack(cameraTrack);
            }
        };
        
        appendSystemMessage('Screen sharing started');
    } catch (error) {
        console.error('Error sharing screen:', error);
    }
});

// ============================================
// CHAT FUNCTIONALITY
// ============================================
function appendMessage(message, sender, isSystem = false) {
    const messageDiv = document.createElement('div');
    
    if (isSystem) {
        messageDiv.className = 'system-message';
        messageDiv.textContent = message;
    } else if (sender === 'You') {
        messageDiv.className = 'user-message';
        messageDiv.textContent = message;
    } else {
        messageDiv.className = 'peer-message';
        messageDiv.textContent = `${sender}: ${message}`;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendSystemMessage(message) {
    appendMessage(message, null, true);
}

sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !dataChannel || dataChannel.readyState !== 'open') {
        alert('Cannot send message. Connection not ready.');
        return;
    }
    
    dataChannel.send(JSON.stringify({ type: 'chat', message }));
    appendMessage(message, 'You');
    messageInput.value = '';
}

function handleDataChannelMessage(event) {
    let msg;
    try {
        msg = JSON.parse(event.data);
    } catch (e) {
        appendMessage(event.data, 'Peer');
        return;
    }
    
    if (msg.type === 'chat') {
        appendMessage(msg.message, 'Peer');
    } else if (msg.type === 'file') {
        receiveFile(msg);
    } else if (msg.type === 'bye') {
        appendSystemMessage('Peer has ended the call');
        setTimeout(() => {
            window.close();
        }, 2000);
    }
}

// ============================================
// FILE SHARING
// ============================================
sendFileBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file first');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const fileData = {
            type: 'file',
            name: file.name,
            size: file.size,
            data: e.target.result
        };
        
        dataChannel.send(JSON.stringify(fileData));
        appendSystemMessage(`Sent file: ${file.name}`);
        addFileToList(file.name, file.size, e.target.result);
    };
    reader.readAsDataURL(file);
});

function receiveFile(fileData) {
    appendSystemMessage(`Received file: ${fileData.name}`);
    addFileToList(fileData.name, fileData.size, fileData.data);
}

function addFileToList(fileName, fileSize, fileData) {
    const emptyMessage = fileList.querySelector('.empty-message');
    if (emptyMessage) {
        emptyMessage.remove();
    }
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
        <div class="file-info">
            <span class="file-icon">📄</span>
            <div class="file-details">
                <div class="file-name">${fileName}</div>
                <div class="file-size">${formatFileSize(fileSize)}</div>
            </div>
        </div>
        <button class="download-btn" onclick="downloadFile('${fileName}', '${fileData}')">
            Download
        </button>
    `;
    fileList.appendChild(fileItem);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function downloadFile(fileName, fileData) {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    link.click();
}

// Make downloadFile globally accessible
window.downloadFile = downloadFile;

// ============================================
// HANG UP
// ============================================
hangUpBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to end this call?')) {
        // Notify peer
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({ type: 'bye' }));
        }
        
        // Clean up
        if (peerConnection) {
            peerConnection.close();
        }
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // Close this window and return to parent
        if (window.opener) {
            window.opener.location.reload();
        }
        window.close();
    }
});

// Handle window close
window.addEventListener('beforeunload', () => {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'bye' }));
    }
});