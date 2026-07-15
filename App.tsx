import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Save, Sparkles, CheckCircle2 } from 'lucide-react';

interface FormState {
  hcp_name: string;
  interaction_type: string;
  date: string;
  time: string;
  attendees: string;
  topics_discussed: string;
  materials_shared: string;
  samples_distributed: string;
  sentiment: string;
  outcomes: string;
  followup_actions: string;
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
  toolExecuted?: string;
}

export default function App() {
  // Form state holding the active structured log
  const [form, setForm] = useState<FormState>({
    hcp_name: '',
    interaction_type: 'Meeting',
    date: new Date().toISOString().split('T')[0],
    time: '',
    attendees: '',
    topics_discussed: '',
    materials_shared: '', 
    samples_distributed: '', 
    sentiment: 'Neutral',
    outcomes: '',
    followup_actions: '',
  });

  // Chat message feed
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: 'Hello! I am your AI CRM Assistant. You can describe your doctor meeting here (e.g. "I met Dr. Smith today at 2 PM to discuss Product X, she liked it but wanted samples"), and I will fill out the log automatically!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle manual edits to form fields
  const handleInputChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Direct Frontend processing via standard dynamic fetch to Groq API
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuery = input;
    setMessages(prev => [...prev, { sender: 'user', text: userQuery }]);
    setInput('');
    setLoading(true);

    // Pull credentials securely via Vite environment variables
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;

    if (!apiKey) {
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: "System Alert: Groq API Key missing. Please provide a VITE_GROQ_API_KEY value to enable real-time NLP structural extractions." 
      }]);
      setLoading(false);
      return;
    }

    try {
      // Direct extraction request structuring using standard endpoint integration
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are an expert medical CRM data ingestion engine. 
              Analyze the conversational entry and extract key metrics. You must reply strictly in valid JSON format.
              
              Calculate relative dates accurately relative to today's date: ${new Date().toISOString().split('T')[0]}.
              
              Your JSON structure must contain exactly these three properties:
              1. "reply": A concise, natural summary describing the processing action or missing details.
              2. "detected_tool": Must be exactly "LOG_INTERACTION".
              3. "tool_updates": An object containing extracted keys matched against current form elements:
                 - hcp_name (string)
                 - interaction_type (Must map explicitly to either: "Meeting", "Email", "Phone Call", or "Lunch & Learn")
                 - date (string formatted strictly as YYYY-MM-DD)
                 - time (string matching HH:MM AM/PM)
                 - attendees (string listing additional staff)
                 - topics_discussed (string summary)
                 - followup_actions (string summary)
                 - sentiment (Must map strictly to either: "Positive", "Neutral", or "Negative")`
            },
            {
              role: "user",
              content: `Current Form Context: ${JSON.stringify(form)}\nUser Ingestion Note: "${userQuery}"`
            }
          ]
        })
      });

      if (!response.ok) throw new Error("Groq API communication barrier encountered");

      const rawResult = await response.json();
      const payload = JSON.parse(rawResult.choices[0].message.content || "{}");

      // Append structured textual feedback
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: payload.reply || "Log details parsed successfully.",
        toolExecuted: payload.detected_tool || "LOG_INTERACTION"
      }]);

      // Apply structured extractions directly to current UI state context
      if (payload.tool_updates) {
        setForm(prev => ({
          ...prev,
          ...payload.tool_updates
        }));
      }

    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: "An issue occurred processing your request against the AI pipeline." }]);
    } finally {
      setLoading(false);
    }
  };

  // Save interaction records to the browser cache (LocalStorage Engine)
  const handleSaveForm = async () => {
    setSaveStatus("Saving...");
    try {
      // Read existing storage chain
      const currentHistory = JSON.parse(localStorage.getItem('hcp_crm_records') || '[]');
      
      // Append new complete interaction object
      const updatedHistory = [...currentHistory, { ...form, id: Date.now() }];
      
      // Sync back to local storage context
      localStorage.setItem('hcp_crm_records', JSON.stringify(updatedHistory));

      setSaveStatus("Saved Successfully to Browser Storage!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus("Error caching interaction state.");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-teal-400 w-6 h-6 animate-pulse" />
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            AI-First HCP CRM
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">Environment Mode: <span className="text-emerald-400 font-semibold">Serverless Live Edge</span></span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Structured Form Layout */}
        <section className="w-1/2 p-6 flex flex-col overflow-y-auto border-r border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold">HCP Interaction Logger</h2>
              <p className="text-xs text-slate-400">Review structured details extracted directly from your conversation</p>
            </div>
            <button
              onClick={handleSaveForm}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 active:scale-95 transition-transform text-slate-950 font-bold rounded-lg text-sm shadow-md"
            >
              <Save className="w-4 h-4" />
              Save Record
            </button>
          </div>

          {saveStatus && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${saveStatus.includes("Error") ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              <CheckCircle2 className="w-4 h-4" />
              {saveStatus}
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">HCP Name (Doctor)</label>
              <input
                type="text"
                value={form.hcp_name}
                onChange={(e) => handleInputChange('hcp_name', e.target.value)}
                placeholder="Dr. Name"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Interaction Type</label>
              <select
                value={form.interaction_type}
                onChange={(e) => handleInputChange('interaction_type', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              >
                <option value="Meeting">Meeting</option>
                <option value="Email">Email</option>
                <option value="Phone Call">Phone Call</option>
                <option value="Lunch & Learn">Lunch & Learn</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Sentiment State</label>
              <select
                value={form.sentiment}
                onChange={(e) => handleInputChange('sentiment', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              >
                <option value="Positive">Positive</option>
                <option value="Neutral">Neutral</option>
                <option value="Negative">Negative</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Date</label>
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                value={form.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Time</label>
              <input
                type="text"
                placeholder="HH:MM AM/PM"
                value={form.time}
                onChange={(e) => handleInputChange('time', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Attendees</label>
              <input
                type="text"
                placeholder="Staff names or companions present"
                value={form.attendees}
                onChange={(e) => handleInputChange('attendees', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Topics Discussed</label>
              <textarea
                rows={2}
                placeholder="Main conversation focus..."
                value={form.topics_discussed}
                onChange={(e) => handleInputChange('topics_discussed', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200 resize-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Follow-up Actions</label>
              <textarea
                rows={2}
                placeholder="What action steps need to happen next?"
                value={form.followup_actions}
                onChange={(e) => handleInputChange('followup_actions', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200 resize-none"
              />
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: AI Chat Panel */}
        <section className="w-1/2 flex flex-col bg-slate-950">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <span className="font-semibold text-sm">Copilot Chat Session</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-teal-400 font-mono">Edge Ingestion Active</span>
          </div>

          {/* Messages Frame */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender !== 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20">
                    <Bot className="w-5 h-5" />
                  </div>
                )}
                
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${msg.sender === 'user' ? 'bg-teal-500 text-slate-950 rounded-tr-none font-medium' : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800/80'}`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  
                  {msg.toolExecuted && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center gap-1.5 text-[10px] text-teal-400 font-mono">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Executed tool: {msg.toolExecuted}</span>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center shrink-0 border border-slate-700">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20 animate-pulse">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center">
                  <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form Input Frame */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900/30 flex gap-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 'Logged a meeting with Dr. Evan Smith today at 3pm, we discussed Product X.'"
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-teal-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-xl flex items-center justify-center transition-colors shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>

      </main>
    </div>
  );
}