import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Gift, Share2, MessageSquare, CheckCircle2, Facebook, MessageCircle, ArrowRight, Trophy, Heart } from 'lucide-react';

type Step = 'landing' | 'questions' | 'boxes' | 'final';

interface Question {
  id: number;
  text: string;
}

const QUESTIONS: Question[] = [
  { id: 1, text: "Você já usa Unitel Money?" },
  { id: 2, text: "O teu chip Unitel está registrado?" },
  { id: 3, text: "Você gosta da Unitel?" },
];

const BOXES_COUNT = 6;
const MAX_ATTEMPTS = 3;
const PRIZE_VALUE = 5000;

export default function App() {
  const [step, setStep] = useState<Step>('landing');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [openedBoxes, setOpenedBoxes] = useState<number[]>([]);
  const [prizes, setPrizes] = useState<number[]>([]);
  const [totalPrize, setTotalPrize] = useState(0);
  const [comment, setComment] = useState('');
  const [recentComments, setRecentComments] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isSharing, setIsSharing] = useState(false);

  // Mock initial prizes (3 winning boxes, 3 empty)
  const [boxContents] = useState(() => {
    const contents = new Array(BOXES_COUNT).fill(0);
    const winningIndices = new Set<number>();
    while (winningIndices.size < 3) {
      winningIndices.add(Math.floor(Math.random() * BOXES_COUNT));
    }
    winningIndices.forEach(idx => contents[idx] = PRIZE_VALUE);
    return contents;
  });

  useEffect(() => {
    if (step === 'final') {
      fetch('/api/comments')
        .then(res => res.json())
        .then(data => setRecentComments(data));
      
      fetch('/api/leaderboard')
        .then(res => res.json())
        .then(data => setLeaderboard(data));
    }
  }, [step]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 9) return;

    try {
      const res = await fetch('/api/user/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      setUserId(data.userId);
      setStep('questions');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnswer = async (answer: string) => {
    const newAnswers = { ...answers, [QUESTIONS[currentQuestion].id]: answer };
    setAnswers(newAnswers);

    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // Save answers to DB
      await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, answers: newAnswers }),
      });
      setStep('boxes');
    }
  };

  const handleOpenBox = async (index: number) => {
    if (openedBoxes.includes(index) || openedBoxes.length >= MAX_ATTEMPTS) return;

    const newOpened = [...openedBoxes, index];
    setOpenedBoxes(newOpened);

    const prize = boxContents[index];
    if (prize > 0) {
      const newTotal = totalPrize + prize;
      setTotalPrize(newTotal);
      setPrizes([...prizes, prize]);
    }

    if (newOpened.length === MAX_ATTEMPTS) {
      // Small delay before moving to final step
      setTimeout(async () => {
        await fetch('/api/user/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, prizeTotal: totalPrize + (prize > 0 ? prize : 0) }),
        });
        
        // Refresh leaderboard
        const lbRes = await fetch('/api/leaderboard');
        const lbData = await lbRes.json();
        setLeaderboard(lbData);

        setStep('final');
      }, 2000);
    }
  };

  const handleCommentSubmit = async () => {
    if (!comment.trim()) return;
    await fetch('/api/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, comment }),
    });
    setComment('');
    // Refresh comments
    const res = await fetch('/api/comments');
    const data = await res.json();
    setRecentComments(data);

    // Refresh leaderboard
    const lbRes = await fetch('/api/leaderboard');
    const lbData = await lbRes.json();
    setLeaderboard(lbData);
  };

  const handleLike = async (commentId: number) => {
    try {
      await fetch('/api/comment/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      });
      // Refresh comments to show updated likes
      const res = await fetch('/api/comments');
      const data = await res.json();
      setRecentComments(data);

      // Refresh leaderboard
      const lbRes = await fetch('/api/leaderboard');
      const lbData = await lbRes.json();
      setLeaderboard(lbData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = (platform: 'whatsapp' | 'facebook', type: 'total' | 'single' | 'participation' = 'total') => {
    setIsSharing(true);
    let text = '';
    
    switch(type) {
      case 'single':
        text = `Acabei de encontrar 5.000 Kz no Unitel Money! 🎁 Tenta a tua sorte também: ${window.location.href}`;
        break;
      case 'participation':
        text = `Estou a participar na Campanha Unitel Money para ganhar prémios incríveis! 💸 Participa aqui: ${window.location.href}`;
        break;
      default:
        text = `Ganhei um total de ${totalPrize.toLocaleString()} Kz no Unitel Money! 🏆 Não fiques de fora: ${window.location.href}`;
    }

    const url = platform === 'whatsapp' 
      ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
      : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
    
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mb-8 flex flex-col items-center"
      >
        <div className="bg-white p-1 rounded-2xl shadow-lg mb-4 flex items-center border-b-4 border-unitel-blue">
          <div className="bg-unitel-orange px-4 py-2 rounded-xl">
            <h1 className="text-white font-black text-2xl tracking-tighter flex items-center gap-2">
              UNITEL <span className="text-unitel-blue">MONEY</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-2 h-2 rounded-full bg-unitel-blue"
          ></motion.div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Campanha Oficial</span>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
          >
            <div className="relative h-48 unitel-gradient flex items-center justify-center overflow-hidden">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="text-white opacity-20 absolute -right-8 -bottom-8"
              >
                <Gift size={160} />
              </motion.div>
              <div className="text-center px-6 relative z-10">
                <h2 className="text-white text-2xl font-bold mb-2">Campanha Promocional</h2>
                <p className="text-white/90 text-sm">Participe do jogo de perguntas rápidas e descubra se você ganhou um prêmio surpresa.</p>
              </div>
            </div>

            <form onSubmit={handleStart} className="p-8 space-y-6">
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">Número de Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-unitel-orange" size={20} />
                  <input
                    required
                    type="tel"
                    placeholder="9xx xxx xxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-unitel-orange rounded-2xl outline-none transition-all text-lg font-medium"
                  />
                </div>
              </motion.div>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full unitel-gradient text-white font-bold py-4 rounded-2xl shadow-lg shadow-unitel-orange/30 transition-all flex items-center justify-center gap-2"
              >
                COMEÇAR AGORA <ArrowRight size={20} />
              </motion.button>
            </form>
          </motion.div>
        )}

        {step === 'questions' && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border-t-4 border-unitel-blue"
          >
            <div className="mb-8">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-unitel-blue uppercase tracking-widest">Pergunta {currentQuestion + 1} de 3</span>
                <span className="text-2xl font-black text-gray-200">0{currentQuestion + 1}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentQuestion + 1) / 3) * 100}%` }}
                  className="h-full bg-unitel-orange"
                />
              </div>
            </div>

            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-gray-800 mb-12 text-center leading-tight"
            >
              {QUESTIONS[currentQuestion].text}
            </motion.h2>

            <div className="grid grid-cols-2 gap-4">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.05, borderColor: '#FF6321', color: '#FF6321' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer('SIM')}
                className="py-6 rounded-2xl border-2 border-gray-100 font-bold text-xl transition-all"
              >
                SIM
              </motion.button>
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.05, borderColor: '#FF6321', color: '#FF6321' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer('NÃO')}
                className="py-6 rounded-2xl border-2 border-gray-100 font-bold text-xl transition-all"
              >
                NÃO
              </motion.button>
            </div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 pt-6 border-t border-gray-50 flex flex-col items-center"
            >
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-3">Convide amigos para participar</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleShare('whatsapp', 'participation')}
                  className="p-3 bg-[#25D366]/10 text-[#25D366] rounded-full hover:bg-[#25D366] hover:text-white transition-all"
                >
                  <MessageCircle size={18} />
                </button>
                <button 
                  onClick={() => handleShare('facebook', 'participation')}
                  className="p-3 bg-[#1877F2]/10 text-[#1877F2] rounded-full hover:bg-[#1877F2] hover:text-white transition-all"
                >
                  <Facebook size={18} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {step === 'boxes' && (
          <motion.div
            key="boxes"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-md text-center"
          >
            <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Obrigado por responder!</h2>
              <p className="text-gray-500 mb-6">Agora você pode abrir até <span className="font-bold text-unitel-orange">3 caixas</span> surpresa.</p>
              
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: BOXES_COUNT }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={!openedBoxes.includes(i) && openedBoxes.length < MAX_ATTEMPTS ? { scale: 1.05, rotate: [0, -2, 2, 0] } : {}}
                    whileTap={!openedBoxes.includes(i) && openedBoxes.length < MAX_ATTEMPTS ? { scale: 0.95 } : {}}
                    onClick={() => handleOpenBox(i)}
                    className={`aspect-square rounded-2xl flex items-center justify-center cursor-pointer transition-all relative overflow-hidden ${
                      openedBoxes.includes(i) 
                        ? 'bg-gray-50' 
                        : 'bg-unitel-orange/10 border-2 border-dashed border-unitel-orange/30'
                    }`}
                  >
                    {openedBoxes.includes(i) ? (
                      boxContents[i] > 0 ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                          className="text-center"
                        >
                          <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                          >
                            <Trophy className="text-yellow-500 mx-auto mb-1" size={24} />
                          </motion.div>
                          <span className="text-[10px] font-black text-unitel-orange">5.000 Kz</span>
                        </motion.div>
                      ) : (
                        <motion.span
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-gray-300 text-xs font-bold uppercase"
                        >
                          Vazia
                        </motion.span>
                      )
                    ) : (
                      <motion.div
                        animate={openedBoxes.length < MAX_ATTEMPTS ? { y: [0, -2, 0] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <Gift className="text-unitel-orange" size={32} />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 flex justify-between items-center px-2">
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Tentativas</p>
                  <p className="text-xl font-black text-gray-800">{MAX_ATTEMPTS - openedBoxes.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Ganhos</p>
                  <p className="text-xl font-black text-unitel-orange">{totalPrize.toLocaleString()} Kz</p>
                </div>
              </div>
            </div>

            {openedBoxes.length > 0 && openedBoxes.length < MAX_ATTEMPTS && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl font-bold text-white shadow-xl flex flex-col items-center gap-3 ${
                  boxContents[openedBoxes[openedBoxes.length - 1]] > 0 
                    ? 'bg-green-500' 
                    : 'bg-gray-400'
                }`}
              >
                <span>
                  {boxContents[openedBoxes[openedBoxes.length - 1]] > 0 
                    ? 'Parabéns! Você encontrou 5.000 Kz.' 
                    : 'Caixa vazia. Tente novamente.'}
                </span>
                
                {boxContents[openedBoxes[openedBoxes.length - 1]] > 0 && (
                  <div className="flex gap-2 mt-1">
                    <button 
                      onClick={() => handleShare('whatsapp', 'single')}
                      className="bg-white/20 hover:bg-white/40 p-2 rounded-lg transition-all flex items-center gap-2 text-xs"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <button 
                      onClick={() => handleShare('facebook', 'single')}
                      className="bg-white/20 hover:bg-white/40 p-2 rounded-lg transition-all flex items-center gap-2 text-xs"
                    >
                      <Facebook size={14} /> Facebook
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {step === 'final' && (
          <motion.div
            key="final"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-6"
          >
            <div className="bg-white rounded-3xl shadow-xl p-8 text-center border-t-4 border-unitel-blue">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.3 }}
                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle2 className="text-green-500" size={48} />
              </motion.div>
              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-black text-gray-800 mb-2"
              >
                Parabéns!
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-500 mb-4"
              >
                Você ganhou um total de
              </motion.p>
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', delay: 0.6 }}
                className="text-4xl font-black text-unitel-orange mb-8"
              >
                {totalPrize.toLocaleString()} Kz
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-gray-50 rounded-2xl p-6 text-left space-y-4"
              >
                <p className="text-sm font-bold text-gray-700">Para receber o prêmio complete os últimos passos:</p>
                <ul className="space-y-3 text-sm text-gray-600">
                  {[
                    { id: 1, text: "Deixe um comentário abaixo" },
                    { id: 2, text: "Compartilhe com 5 amigos" },
                    { id: 3, text: "Aguarde a confirmação via SMS" }
                  ].map((item, idx) => (
                    <motion.li 
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + (idx * 0.1) }}
                      className="flex gap-3"
                    >
                      <span className="flex-shrink-0 w-6 h-6 bg-unitel-orange text-white rounded-full flex items-center justify-center text-xs font-bold">{item.id}</span>
                      {item.text}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Leaderboard Section */}
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="text-unitel-orange" size={20} />
                <h3 className="font-bold text-gray-800">Top Ganhadores</h3>
              </div>
              
              <div className="space-y-3">
                {leaderboard.map((user, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        i === 0 ? 'bg-yellow-400 text-white' : 
                        i === 1 ? 'bg-gray-300 text-white' : 
                        i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {i + 1}
                      </div>
                      <span className="text-sm font-bold text-gray-700">
                        {user.phone.slice(0, 3)}***{user.phone.slice(-2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-unitel-orange">{user.prize_total.toLocaleString()} Kz</p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400">
                        <Heart size={10} className="fill-red-400 text-red-400" />
                        <span>{user.likes}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {leaderboard.length === 0 && (
                  <p className="text-center text-gray-400 text-xs py-4">Ainda não há ganhadores. Seja o primeiro!</p>
                )}
              </div>
            </div>

            {/* Comment Section */}
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="text-unitel-orange" size={20} />
                <h3 className="font-bold text-gray-800">Deixe seu comentário</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Estou muito feliz, ganhei!"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="flex-1 bg-gray-50 border-2 border-transparent focus:border-unitel-orange rounded-xl px-4 py-3 outline-none text-sm"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCommentSubmit}
                  className="bg-unitel-orange text-white px-6 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  Enviar
                </motion.button>
              </div>

              <div className="mt-8 space-y-4 max-h-60 overflow-y-auto pr-2">
                <AnimatePresence>
                  {recentComments.map((c, i) => (
                    <motion.div 
                      key={c.id || i} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-gray-50 p-4 rounded-2xl border border-gray-100"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-unitel-orange uppercase">Usuário {c.phone.slice(-4)}****</span>
                        <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-700 italic mb-2">"{c.comment}"</p>
                      <div className="flex justify-end">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleLike(c.id)}
                          className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Heart size={14} className={c.likes > 0 ? 'fill-red-500 text-red-500' : ''} />
                          <span className="text-xs font-bold">{c.likes || 0}</span>
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {recentComments.length === 0 && (
                  <p className="text-center text-gray-400 text-xs py-4">Nenhum comentário ainda. Seja o primeiro!</p>
                )}
              </div>
            </div>

            {/* Share Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleShare('facebook')}
                className="bg-[#1877F2] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
              >
                <Facebook size={20} /> Facebook
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleShare('whatsapp')}
                className="bg-[#25D366] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 transition-all"
              >
                <MessageCircle size={20} /> WhatsApp
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Branding */}
      <div className="mt-12 text-center">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">© 2024 Unitel S.A. Todos os direitos reservados.</p>
      </div>
    </div>
  );
}
