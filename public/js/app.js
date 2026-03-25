// public/js/app.js

// ==================== DOM Elements ====================
const generateTab = document.getElementById('generateTab');
const imageTab = document.getElementById('imageTab');
const chatTab = document.getElementById('chatTab');
const topicInput = document.getElementById('topic');
const contentTypeSelect = document.getElementById('contentType');
const temperatureSlider = document.getElementById('temperature');
const tempValue = document.getElementById('tempValue');
const maxLengthSelect = document.getElementById('maxLength');
const generateBtn = document.getElementById('generateBtn');
const generateResponse = document.getElementById('generateResponse');
const generateLoading = document.getElementById('generateLoading');
const imageInput = document.getElementById('imageInput');
const imageQuestion = document.getElementById('imageQuestion');
const analyzeBtn = document.getElementById('analyzeBtn');
const imageResponse = document.getElementById('imageResponse');
const imageLoading = document.getElementById('imageLoading');
const imagePreview = document.getElementById('imagePreview');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const chatLoading = document.getElementById('chatLoading');
const themeToggle = document.getElementById('themeToggle');


let currentGenerateResponse = '';
let currentImageResponse = '';
let chatHistory = [];

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light');
        themeToggle.textContent = '☀️';
    } else {
        themeToggle.textContent = '🌙';
    }
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggle.textContent = isLight ? '☀️' : '🌙';
});

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        
        // Update tab active state
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update content active state
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        if (tabId === 'generate') {
            generateTab.classList.add('active');
        } else if (tabId === 'image') {
            imageTab.classList.add('active');
        } else if (tabId === 'chat') {
            chatTab.classList.add('active');
        }
    });
});

temperatureSlider.addEventListener('input', (e) => {
    tempValue.textContent = e.target.value;
});

async function generateContent() {
    const topic = topicInput.value.trim();
    const contentType = contentTypeSelect.value;
    const temperature = temperatureSlider.value;
    const maxLength = maxLengthSelect.value;

    if (!topic) {
        alert('Kuch topic likho!');
        return;
    }

    generateBtn.disabled = true;
    generateResponse.innerHTML = '';
    generateLoading.style.display = 'block';
    currentGenerateResponse = '';

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, contentType, temperature, maxLength })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            currentGenerateResponse += chunk;
            generateResponse.innerHTML = formatResponse(currentGenerateResponse);
        }

    } catch (error) {
        generateResponse.innerHTML = `<div style="color: #ef4444;">❌ Error: ${error.message}</div>`;
    } finally {
        generateBtn.disabled = false;
        generateLoading.style.display = 'none';
    }
}

generateBtn.addEventListener('click', generateContent);

// Enter key support for topic input
topicInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        generateContent();
    }
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
});

async function analyzeImage() {
    const file = imageInput.files[0];
    const question = imageQuestion.value.trim();
    
    if (!file) {
        alert('Pehle image select karo!');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);
    if (question) formData.append('question', question);

    analyzeBtn.disabled = true;
    imageResponse.innerHTML = '';
    imageLoading.style.display = 'block';

    try {
        const response = await fetch('/api/analyze-image', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        currentImageResponse = data.response;
        imageResponse.innerHTML = formatResponse(data.response);

    } catch (error) {
        imageResponse.innerHTML = `<div style="color: #ef4444;">❌ Error: ${error.message}</div>`;
    } finally {
        analyzeBtn.disabled = false;
        imageLoading.style.display = 'none';
    }
}

analyzeBtn.addEventListener('click', analyzeImage);

function addMessageToChat(message, isUser = false, time = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = escapeHtml(message);
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = time || new Date().toLocaleTimeString();
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
}

async function sendChatMessage() {
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessageToChat(message, true);
    chatInput.value = '';
    
    // Add to history
    chatHistory.push({ role: "user", parts: [{ text: message }] });
    
    // Show loading
    chatLoading.style.display = 'block';
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message, 
                history: chatHistory.slice(0, -1) // Send without current message
            })
        });
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let aiResponse = '';
        const aiMessageDiv = addMessageToChat('', false);
        const contentDiv = aiMessageDiv.querySelector('.message-content');
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            aiResponse += chunk;
            contentDiv.innerHTML = formatResponse(aiResponse);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        // Add to history
        chatHistory.push({ role: "model", parts: [{ text: aiResponse }] });
        
        // Limit history length to prevent token overflow
        if (chatHistory.length > 20) {
            chatHistory = chatHistory.slice(-20);
        }
        
    } catch (error) {
        addMessageToChat(`❌ Error: ${error.message}`, false);
    } finally {
        chatLoading.style.display = 'none';
        chatInput.focus();
    }
}

sendBtn.addEventListener('click', sendChatMessage);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = btn.dataset.target;
        let textToCopy = '';
        
        if (target === 'generate') {
            textToCopy = currentGenerateResponse;
        } else if (target === 'image') {
            textToCopy = currentImageResponse;
        }
        
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
            
            // Show temporary success message
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        } else {
            alert('Pehle content generate karo!');
        }
    });
});

function formatResponse(text) {
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/## (.*?)(<br>|$)/g, '<h3>$1</h3>')
        .replace(/### (.*?)(<br>|$)/g, '<h4>$1</h4>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

initTheme();

// Focus management
topicInput.focus();

// Clear image preview when new file is selected
imageInput.addEventListener('click', () => {
    imageInput.value = '';
    imagePreview.innerHTML = '';
    imageResponse.innerHTML = '<p class="placeholder">Image upload karo aur analyze karo...</p>';
});

console.log('✨ Gemini Content Studio loaded!');