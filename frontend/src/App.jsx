import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './VisionWave.css';

const VisionWave = () => {
    const [messages, setMessages] = useState([
        { text: "Hi, welcome to VisionWave! Upload an Image to Chat. 😄", sender: "left" }
    ]);
    const [userInput, setUserInput] = useState('');
    const [loadingChat, setLoadingChat] = useState(false);
    const [loadingFile, setLoadingFile] = useState(false);
    const chatAreaRef = useRef(null);

    const scrollToBottom = () => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    };

    const clearChat = async () => {
        setMessages([{ text: "Hi, welcome to VisionWave! Upload an Image to Chat. 😄", sender: "left" }]);
        await resetSummary();
    };

    const resetSummary = async () => {
        await fetch('http://127.0.0.1:8000/reset-summary', { method: 'POST' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setLoadingFile(true);
            const formData = new FormData();
            formData.append('file', file);

            setMessages(prev => [...prev, { text: `Uploaded: ${file.name}`, sender: "left" }]);
            const imageUrl = URL.createObjectURL(file);
            const imageMessage = { type: 'image', src: imageUrl, sender: 'left' };
            setMessages(prev => [...prev, imageMessage]);

            let response;
            if (file.type.startsWith('image/')) {
                response = await fetch('http://127.0.0.1:8000/analyze-image/', { method: 'POST', body: formData });
            } else {
                alert('Unsupported file type. Please upload an image or PDF.');
                setLoadingFile(false);
                return;
            }

            if (response.ok) {
                const data = await response.json(); 
                const resultMsg = { text: <ReactMarkdown>{data.result}</ReactMarkdown>, sender: "left" };
                setMessages(prev => [...prev, resultMsg]);
            } else {
                alert('Error analyzing Image.');
            }
            setLoadingFile(false);
        }
    };

    const sendMessage = async () => {
        const userText = userInput.trim();
        if (userText) {
            setMessages(prev => [...prev, { text: userText, sender: "right" }]);
            setUserInput('');
            setLoadingChat(true);

            const response = await fetch('http://127.0.0.1:8000/chat/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_text: userText }),
            });

            if (response.ok) {
                const resultMsg = { text: "Loading response...", sender: "left" };
                setMessages(prev => [...prev, resultMsg]);
                scrollToBottom();

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let result = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    result += decoder.decode(value);
                    const markdownMessage = { text: <ReactMarkdown>{result}</ReactMarkdown>, sender: "left" };
                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = markdownMessage; // Replace loading message with actual response
                        return updated;
                    });
                }
            } else {
                alert('Error during chat response.');
            }
            setLoadingChat(false);
        } else {
            alert('Please enter a message.');
        }
    };

    return (
        <section className="msger">
            <Header onClear={clearChat} />
            <main className="msger-chat" ref={chatAreaRef}>
                {messages.map((msg, index) => (
                    msg.type === 'image' ? (
                        <div key={index} className="image-preview">
                            <img src={msg.src} alt="Uploaded" className="uploaded-image" />
                        </div>
                    ) : (
                        <Message key={index} text={msg.text} sender={msg.sender} />
                    )
                ))}
            </main>
            {loadingChat && <LoadingIndicator text="Loading response..." />}
            {loadingFile && <LoadingIndicator text="Analyzing Image..." />}
            <InputArea
                userInput={userInput}
                setUserInput={setUserInput}
                onSend={sendMessage}
                onFileUpload={handleFileUpload}
            />
        </section>
    );
};

const Header = ({ onClear }) => (
    <header className="msger-header">
        <div className="msger-header-title">
            <i className="fas fa-eye"></i> VisionWave: AI Image Analyzer
        </div>
        <button className="clear-btn" onClick={onClear}>Clear</button>
    </header>
);

const Message = ({ text, sender }) => (
    <div className={`msg ${sender}-msg`}>
        <div className="msg-bubble">
            <div className="msg-text">{text}</div>
        </div>
    </div>
);

const InputArea = ({ userInput, setUserInput, onSend, onFileUpload }) => (
    <form className="msger-inputarea" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
        <input
            type="text"
            className="msger-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Enter your message..."
        />
        <label htmlFor="file-upload" className="file-upload-icon">
            <i className="fa fa-paperclip" aria-hidden="true"></i> Upload Image
        </label>
        <input type="file" id="file-upload" onChange={onFileUpload} style={{ display: 'none' }} />
        <button type="button" className="msger-send-btn" onClick={onSend}>Send Message</button>
    </form>
);

const LoadingIndicator = ({ text }) => (
    <div className="loading">
        <div className="spinner"></div>
        {text}
    </div>
);

export default VisionWave;
