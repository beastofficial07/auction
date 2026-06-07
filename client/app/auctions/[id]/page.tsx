'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { fmt, roleColors, categoryColors, roleIcons } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import api, { imgUrl } from '@/lib/api';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

// Activity logging function for admin dashboard
const logActivityToAdmin = async (type: string, title: string, data?: any) => {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    await fetch(`${apiBase}/api/activity-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, userId: data?.userId || 'auction_user', data })
    });
  } catch {
    // Non-critical — silently ignore
  }
};

interface Player { _id:string; name:string; role:string; category:string; basePrice:number; imageUrl?:string; stats:any; nationality:string; age?:number; }
interface Team   { _id:string; name:string; shortName:string; purse:number; initialPurse:number; primaryColor:string; logo?:string; playersCount:number; maxPlayers:number; rtmTotal:number; rtmUsed:number; ownerName?:string; city?:string; ownerId?:any; }
interface BidEntry { teamId:string; teamName:string; teamShortName:string; teamColor:string; bidAmount:number; bidAmountFormatted:string; timestamp:string; }

export default function LiveAuctionPage() {
  const { id } = useParams<{ id:string }>();
  const router  = useRouter();
  const { user } = useAuth();

  const [auction,         setAuction]        = useState<any>(null);
  const [teams,           setTeams]           = useState<Team[]>([]);
  const [currentPlayer,   setCurrentPlayer]   = useState<Player|null>(null);
  const [currentBid,      setCurrentBid]      = useState(0);
  const [currentBidFmt,   setCurrentBidFmt]   = useState('');
  const [leadingTeamId,   setLeadingTeamId]   = useState<string|null>(null);
  const [leadingTeamName, setLeadingTeamName] = useState('');
  const [leadingTeamColor,setLeadingTeamColor]= useState('hsl(45,100%,51%)');
  const [timer,           setTimer]           = useState(0);
  const [bidHistory,      setBidHistory]      = useState<BidEntry[]>([]);
  const [auctionStatus,   setAuctionStatus]   = useState('draft');
  const [myTeamId,        setMyTeamId]        = useState<string|null>(null);
  const [bidConfig,       setBidConfig]       = useState({ bidTimer:30, bidIncrement:500000 });
  const [connected,       setConnected]       = useState(false);
  const [isOrganizer,     setIsOrganizer]     = useState(false);
  const [rtmEnabled,      setRtmEnabled]      = useState(false);
  const [soldData,        setSoldData]        = useState<any>(null);
  const [rtmTimer,        setRtmTimer]        = useState(0);
  const [rtmWindowOpen,   setRtmWindowOpen]   = useState(false);
  const [rtmUsed,         setRtmUsed]         = useState(false);
  const [unsoldPlayer,    setUnsoldPlayer]    = useState<Player|null>(null);
  const [bidFlash,        setBidFlash]        = useState(false);
  const [playerHistory,   setPlayerHistory]   = useState<any[]>([]);

  const myTeam      = teams.find(t => t._id === myTeamId);
  const isLeading   = !!myTeamId && leadingTeamId === myTeamId;
  const isTeamOwner = user?.role === 'team_owner';
  const canBid      = isTeamOwner && myTeam && auctionStatus==='active' && timer>0 && currentPlayer && !isLeading && (myTeam.purse >= currentBid + bidConfig.bidIncrement);
  const timerPct    = bidConfig.bidTimer > 0 ? (timer/bidConfig.bidTimer)*100 : 0;
  const timerColor  = timer<=5 ? '#ef4444' : timer<=10 ? '#f97316' : 'hsl(45,100%,51%)';
  const C           = 2*Math.PI*52;
  const rtmRemaining= myTeam ? myTeam.rtmTotal - myTeam.rtmUsed : 0;

  // Fetch auction info
  useEffect(() => {
    if (!id) return;
    api.get(`/auctions/${id}`).then(r => {
      setAuction(r.data.auction);
      setRtmEnabled(r.data.auction.rtmEnabled);
      if (user?.role==='organizer'||user?.role==='admin') setIsOrganizer(true);
    }).catch(()=>{});
  }, [id, user]);

  // Socket connection
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    setConnected(socket.connected);
    socket.on('connect',    ()=>setConnected(true));
    socket.on('disconnect', ()=>setConnected(false));
    socket.emit('joinAuction', { auctionId: id });

    socket.on('auctionState', (s:any)=>{
      setTeams(s.teams||[]);
      setCurrentPlayer(s.currentPlayer);
      setCurrentBid(s.currentBid||0);
      setCurrentBidFmt(s.currentBidFormatted||'');
      setLeadingTeamId(s.leadingTeamId);
      setLeadingTeamName(s.leadingTeamName||'');
      setLeadingTeamColor(s.leadingTeamColor||'hsl(45,100%,51%)');
      setTimer(s.timer||0);
      setBidHistory(s.bidHistory||[]);
      setAuctionStatus(s.status||'draft');
      if (s.myTeamId) setMyTeamId(s.myTeamId);
      if (s.auctionConfig) setBidConfig(s.auctionConfig);
      if (s.rtmEnabled!==undefined) setRtmEnabled(s.rtmEnabled);
    });
    socket.on('auctionStarted', ()=>{ setAuctionStatus('active'); toast.success('🏏 Auction started!'); });
    socket.on('auctionPaused',  ()=>{ setAuctionStatus('paused'); toast('⏸ Paused'); });
    socket.on('auctionResumed', ()=>{ setAuctionStatus('active'); toast('▶️ Resumed'); });
    socket.on('nextPlayer', (d:any)=>{
      setCurrentPlayer(d.player); setCurrentBid(d.basePrice); setCurrentBidFmt(d.basePriceFormatted);
      setLeadingTeamId(null); setLeadingTeamName(''); setLeadingTeamColor('hsl(45,100%,51%)');
      setTimer(d.timer); setBidHistory([]);
      setSoldData(null); setUnsoldPlayer(null); setRtmWindowOpen(false); setRtmTimer(0); setRtmUsed(false);
    });
    socket.on('timerTick', ({timer:t}:any)=>setTimer(t));
    socket.on('bidUpdate', (d:any)=>{
      setCurrentBid(d.currentBid); setCurrentBidFmt(d.currentBidFormatted);
      setLeadingTeamId(d.leadingTeamId); setLeadingTeamName(d.leadingTeamName); setLeadingTeamColor(d.leadingTeamColor);
      setTimer(d.timer);
      setBidHistory(prev=>[d.bidEntry,...prev].slice(0,20));
      setBidFlash(true); setTimeout(()=>setBidFlash(false),600);
    });
    socket.on('playerSold', async (d:any)=>{
      setSoldData(d); setUnsoldPlayer(null);
      
      // Log activity to admin dashboard
      await logActivityToAdmin('player_sold', `Player sold: ${d.player.name} to ${d.team.name} for ₹${fmt(d.soldPrice)}`, {
        playerId: d.player._id,
        playerName: d.player.name,
        teamId: d.team._id,
        teamName: d.team.name,
        soldPrice: d.soldPrice,
        auctionId: id,
        auctionName: auction?.name,
        userId: user?._id
      });
      if (d.teams) setTeams(d.teams);
      setPlayerHistory(prev=>[{...d.player,soldTo:d.soldTo,soldPrice:d.soldPrice},...prev].slice(0,10));
      confetti({particleCount:200,spread:80,origin:{y:0.6},colors:['hsl(45,100%,51%)','hsl(40,100%,38%)','hsl(45,100%,70%)','#fff']});
      setTimeout(()=>confetti({particleCount:100,spread:120,origin:{y:0.4}}),400);
      if (d.rtmEnabled) { setRtmWindowOpen(true); setRtmTimer(d.rtmWindow||15); }
    });
    socket.on('rtmTick',    ({timer:t}:any)=>setRtmTimer(t));
    socket.on('rtmExecuted',(d:any)=>{ setRtmWindowOpen(false); setRtmTimer(0); if(d.teams) setTeams(d.teams); toast.success(d.message,{duration:5000}); });
    socket.on('rtmDeclined',()=>{ setRtmWindowOpen(false); setRtmTimer(0); });
    socket.on('playerUnsold',(d:any)=>{ setUnsoldPlayer(d.player); setSoldData(null); setRtmWindowOpen(false); });
    socket.on('auctionCompleted',()=>{ setAuctionStatus('completed'); setCurrentPlayer(null); toast.success('🏆 Auction complete!'); });
    socket.on('bidError',({message}:any)=>toast.error(message));
    socket.on('teamJoined',(d:any)=>{ if(d.teams) setTeams(d.teams); });

    return ()=>{
      ['auctionState','auctionStarted','auctionPaused','auctionResumed','nextPlayer','timerTick',
       'bidUpdate','playerSold','rtmTick','rtmExecuted','rtmDeclined','playerUnsold','auctionCompleted','bidError','teamJoined']
        .forEach(e=>socket.off(e));
    };
  }, [id]);

  const placeBid = useCallback(async ()=>{
    if (!myTeamId||!currentPlayer) return;
    getSocket().emit('placeBid',{auctionId:id,teamId:myTeamId,bidAmount:currentBid+bidConfig.bidIncrement});
    
    // Log activity to admin dashboard
    await logActivityToAdmin('bid', `Bid placed: ${myTeam?.name || 'Unknown Team'} bid ₹${fmt(currentBid + bidConfig.bidIncrement)}`, {
      teamId: myTeamId,
      teamName: myTeam?.name,
      bidAmount: currentBid + bidConfig.bidIncrement,
      playerName: currentPlayer?.name,
      auctionId: id,
      auctionName: auction?.name,
      userId: user?._id
    });
  },[myTeamId,currentPlayer,currentBid,bidConfig.bidIncrement,id]);

  const triggerRTM = useCallback(()=>{
    if (!soldData?.player) return;
    setRtmUsed(true);
    getSocket().emit('triggerRTM',{auctionId:id,playerId:soldData.player._id});
    toast('🎯 RTM triggered!',{icon:'🎯'});
  },[soldData,id]);

  const declineRTM = useCallback(()=>{
    setRtmWindowOpen(false);
    getSocket().emit('declineRTM',{auctionId:id});
  },[id]);

  const emit = (event:string)=>getSocket().emit(event,{auctionId:id});

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{background:'hsl(222 47% 5%)'}}>

      {/* ── TOP BAR ── */}
      <div className="flex-shrink-0 border-b border-border/40 px-4 py-2.5 flex items-center justify-between z-20"
        style={{background:'hsla(222,40%,8%,0.97)',backdropFilter:'blur(12px)'}}>
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button onClick={()=>router.back()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-border/40 hover:border-primary/30">
            ← Back
          </button>
          <img src="/beast-logo.png" alt="Beast Cricket" className="w-8 h-8 object-contain"/>
          <span className="text-foreground font-bold hidden sm:block truncate max-w-44" style={{fontFamily:'Oswald,sans-serif',fontSize:'15px',letterSpacing:'1px'}}>{auction?.name||'BEAST CRICKET AUCTION'}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Organizer controls */}
          {isOrganizer && (
            <div className="flex gap-1.5 mr-2">
              {(auctionStatus==='draft'||auctionStatus==='idle') && (
                <button onClick={()=>emit('startAuction')} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-black" style={{background:'hsl(142,70%,45%)'}}>▶ Start</button>
              )}
              {auctionStatus==='active' && (
                <button onClick={()=>emit('pauseAuction')} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-black" style={{background:'hsl(45,100%,51%)'}}>⏸ Pause</button>
              )}
              {auctionStatus==='paused' && (
                <button onClick={()=>emit('resumeAuction')} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-black" style={{background:'hsl(142,70%,45%)'}}>▶ Resume</button>
              )}
              {currentPlayer && auctionStatus==='active' && (
                <button onClick={()=>emit('skipPlayer')} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-foreground" style={{background:'hsl(222,30%,22%)'}}>⏭ Skip</button>
              )}
              {currentPlayer && auctionStatus==='active' && leadingTeamId && (
                <button onClick={()=>emit('forceSell')} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-white" style={{background:'hsl(0,72%,51%)'}}>🔨 Sell</button>
              )}
            </div>
          )}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${connected?'border-green-500/30 bg-green-500/10 text-green-400':'border-red-500/30 bg-red-500/10 text-red-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected?'bg-green-400 animate-pulse':'bg-red-400'}`}/>{connected?'LIVE':'...'}
          </div>
          <span className={`hidden sm:block px-2 py-1 rounded-full text-xs font-bold border ${auctionStatus==='active'?'border-green-500/30 bg-green-500/10 text-green-400':auctionStatus==='paused'?'border-yellow-500/30 bg-yellow-500/10 text-yellow-400':'border-muted bg-muted/20 text-muted-foreground'}`}>{auctionStatus.toUpperCase()}</span>
          {user && <span className="text-muted-foreground text-xs hidden lg:block" style={{fontFamily:'Rajdhani,sans-serif'}}>{user.name}{isOrganizer?' (Host)':myTeam?` · ${myTeam.name}`:''}</span>}
        </div>
      </div>

      {/* ── RTM OVERLAY ── */}
      <AnimatePresence>
        {rtmWindowOpen && soldData && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{background:'hsl(222 47% 5%)',backdropFilter:'blur(12px)'}}>
            <motion.div initial={{scale:0.8,y:30}} animate={{scale:1,y:0}} transition={{type:'spring',stiffness:300,damping:25}}
              className="max-w-md w-full mx-6 rounded-3xl overflow-hidden"
              style={{background:'linear-gradient(180deg,hsl(222,40%,10%),hsl(222,47%,6%))',border:'2px solid hsla(45,100%,51%,0.5)',boxShadow:'0 0 80px hsla(45,100%,51%,0.2)'}}>
              <div style={{background:'linear-gradient(135deg,hsl(45,100%,51%),hsl(40,100%,38%))',padding:'20px',textAlign:'center'}}>
                <h2 style={{fontFamily:'Oswald,sans-serif',fontSize:'34px',color:'#000',margin:0,letterSpacing:'2px'}}>🎯 RIGHT TO MATCH</h2>
                <p style={{color:'rgba(0,0,0,0.65)',fontSize:'12px',margin:'4px 0 0',fontFamily:'Rajdhani,sans-serif'}}>Match the bid to retain this player</p>
              </div>
              <div className="p-7">
                {/* Countdown ring */}
                <div className="flex justify-center mb-5">
                  <div className="relative" style={{width:90,height:90}}>
                    <svg viewBox="0 0 100 100" className="w-full h-full" style={{transform:'rotate(-90deg)'}}>
                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8"/>
                      <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" strokeLinecap="round"
                        stroke={rtmTimer<=5?'#ef4444':'hsl(45,100%,51%)'}
                        strokeDasharray={2*Math.PI*44}
                        strokeDashoffset={2*Math.PI*44-(rtmTimer/15)*2*Math.PI*44}
                        style={{transition:'stroke-dashoffset 1s linear'}}/>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span style={{fontFamily:'Oswald,sans-serif',fontSize:'28px',color:'hsl(45,100%,51%)'}}>{rtmTimer}</span>
                      <span className="text-muted-foreground" style={{fontSize:'9px',fontFamily:'Rajdhani,sans-serif'}}>SEC</span>
                    </div>
                  </div>
                </div>
                <div className="text-center mb-6">
                  {soldData.player?.imageUrl && <img src={imgUrl(soldData.player.imageUrl)} alt={soldData.player.name} className="w-20 h-24 rounded-xl object-cover object-top mx-auto mb-3 border-2 border-primary/40"/>}
                  <h3 style={{fontFamily:'Oswald,sans-serif',fontSize:'26px',color:'hsl(45,100%,96%)'}}>{soldData.player?.name}</h3>
                  <p className="text-muted-foreground text-sm">Sold to <span style={{color:soldData.soldTo?.teamColor}} className="font-bold">{soldData.soldTo?.teamName}</span></p>
                  <p className="text-gradient-gold font-bold mt-1" style={{fontFamily:'Oswald,sans-serif',fontSize:'34px'}}>{soldData.soldPriceFormatted}</p>
                </div>
                {isTeamOwner && myTeam && rtmRemaining>0 && !rtmUsed && soldData.soldTo?.teamId!==myTeamId ? (
                  <div className="space-y-3">
                    <div className="rounded-xl p-3 text-center" style={{background:'hsla(45,100%,51%,0.08)',border:'1px solid hsla(45,100%,51%,0.25)'}}>
                      <span className="text-muted-foreground text-sm">RTM cards: </span>
                      <span className="text-primary font-bold">{rtmRemaining} remaining</span>
                    </div>
                    <motion.button onClick={triggerRTM} whileHover={{scale:1.02}} whileTap={{scale:0.97}}
                      className="w-full py-4 rounded-xl font-bold text-black text-lg relative overflow-hidden"
                      style={{fontFamily:'Oswald,sans-serif',letterSpacing:'2px',background:`linear-gradient(135deg,${myTeam.primaryColor},${myTeam.primaryColor}cc)`}}>
                      <span className="relative z-10">🎯 USE RTM — MATCH {soldData.soldPriceFormatted}</span>
                      <motion.div animate={{x:['-100%','100%']}} transition={{duration:2,repeat:Infinity}}
                        className="absolute inset-0 opacity-20" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)'}}/>
                    </motion.button>
                    <button onClick={declineRTM} className="w-full py-3 rounded-xl text-muted-foreground hover:text-foreground text-sm font-bold transition-all" style={{border:'1px solid rgba(255,255,255,0.1)'}}>✕ Decline</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl p-4 text-center" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)'}}>
                      {soldData.soldTo?.teamId===myTeamId ? <p className="text-green-400 font-bold">🏆 You won this player!</p>
                       : rtmRemaining===0 ? <p className="text-muted-foreground text-sm">No RTM cards left</p>
                       : !isTeamOwner ? <p className="text-muted-foreground text-sm">Only team owners can use RTM</p>
                       : rtmUsed ? <p className="text-amber-400 text-sm">RTM being processed...</p>
                       : <p className="text-muted-foreground text-sm">RTM not available</p>}
                    </div>
                    {soldData.soldTo?.teamId!==myTeamId && <button onClick={declineRTM} className="w-full py-3 rounded-xl text-muted-foreground hover:text-foreground text-sm font-bold transition-all" style={{border:'1px solid rgba(255,255,255,0.1)'}}>Close</button>}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN 3-PANEL ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: TEAMS */}
        <div className="w-52 xl:w-60 flex-shrink-0 border-r border-border/40 flex flex-col" style={{background:'hsla(222,42%,7%,0.97)'}}>
          <div className="p-3 border-b border-border/40 flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest" style={{fontFamily:'Oswald,sans-serif'}}>Teams ({teams.length})</h3>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {teams.map(team=>{
              const leading=leadingTeamId===team._id;
              const mine=myTeamId===team._id;
              const pct=team.initialPurse>0?(team.purse/team.initialPurse)*100:0;
              return (
                <div key={team._id} className="rounded-xl p-3 border transition-all duration-300"
                  style={{borderColor:leading?team.primaryColor+'80':mine?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.05)',
                    background:leading?`${team.primaryColor}12`:mine?'rgba(255,255,255,0.04)':'hsla(222,30%,11%,0.5)'}}>
                  <div className="flex items-center gap-2 mb-2">
                    {team.logo?<img src={imgUrl(team.logo)} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0"/>
                      :<div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                        style={{background:`linear-gradient(135deg,${team.primaryColor},${team.primaryColor}88)`,fontFamily:'Oswald,sans-serif'}}>{team.shortName?.slice(0,2)}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground text-xs font-bold truncate" style={{fontFamily:'Rajdhani,sans-serif'}}>{team.name}</div>
                      {mine&&<div style={{fontSize:'10px',color:'hsl(45,100%,51%)',fontWeight:700,fontFamily:'Oswald,sans-serif'}}>YOUR TEAM</div>}
                    </div>
                    {leading&&<span className="flex-shrink-0" style={{fontSize:'14px'}}>👑</span>}
                  </div>
                  <div className="flex justify-between mb-1" style={{fontSize:'11px'}}>
                    <span className="text-muted-foreground">Purse</span>
                    <span className="text-primary font-bold">{fmt(team.purse)}</span>
                  </div>
                  <div className="w-full bg-secondary/20 rounded-full overflow-hidden" style={{height:'3px'}}>
                    <div className="h-full rounded-full transition-all duration-700" style={{width:`${pct}%`,background:`linear-gradient(90deg,${team.primaryColor},${team.primaryColor}80)`}}/>
                  </div>
                  <div className="flex justify-between mt-1" style={{fontSize:'10px'}}>
                    <span className="text-muted-foreground/60">{team.playersCount}/{team.maxPlayers}</span>
                    {(team.rtmTotal-team.rtmUsed)>0&&<span style={{color:'hsl(45,100%,51%)',fontWeight:700}}>🎯{team.rtmTotal-team.rtmUsed}</span>}
                  </div>
                </div>
              );
            })}
            {teams.length===0&&<p className="text-muted-foreground/60 text-xs text-center py-8">No teams yet</p>}
          </div>
          {/* Recent sales */}
          {playerHistory.length>0&&(
            <div className="border-t border-border/40 p-2">
              <div className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2" style={{fontFamily:'Oswald,sans-serif'}}>Sold</div>
              {playerHistory.slice(0,4).map((p,i)=>(
                <div key={i} className="flex items-center justify-between mb-1.5">
                  <span className="text-muted-foreground text-xs truncate max-w-24" style={{fontFamily:'Rajdhani,sans-serif'}}>{p.name}</span>
                  <span className="text-primary font-bold text-xs flex-shrink-0">{fmt(p.soldPrice)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CENTER: STAGE — bg-auction.png */}
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Background image */}
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{backgroundImage:"url('/bg-auction.png')", opacity:0.6}}/>
          <div className="absolute inset-0" style={{background:'radial-gradient(ellipse 80% 80% at 50% 50%, hsla(222,35%,8%,0.3) 0%, hsl(222,47%,5%) 70%)'}}/>
          {/* Subtle grid lines */}
          {[20,50,80].map(x=><div key={x} className="absolute top-0 bottom-0 w-px pointer-events-none" style={{left:`${x}%`,background:'linear-gradient(to bottom,hsla(45,100%,51%,0.04),transparent)'}}/>)}

          {/* SOLD overlay */}
          <AnimatePresence>
            {soldData&&!rtmWindowOpen&&(
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                className="absolute inset-0 z-20 flex items-center justify-center"
                style={{background:'hsl(222 47% 5%)',backdropFilter:'blur(6px)'}}>
                <div className="text-center px-8">
                  <motion.div initial={{scale:0,rotate:-20}} animate={{scale:1,rotate:0}} transition={{type:'spring',stiffness:300,damping:15}} style={{fontSize:'72px',marginBottom:'12px'}}>🔨</motion.div>
                  <motion.h2 initial={{y:30,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.2}} style={{fontFamily:'Oswald,sans-serif',fontSize:'90px',color:'hsl(45,100%,51%)',margin:0,letterSpacing:'4px',textShadow:'0 0 60px hsla(45,100%,51%,0.6)'}}>SOLD!</motion.h2>
                  <motion.p initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.3}} style={{fontFamily:'Oswald,sans-serif',fontSize:'30px',color:'hsl(45,100%,96%)',margin:'8px 0'}}>{soldData.player?.name}</motion.p>
                  <motion.p initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.4}} style={{fontFamily:'Oswald,sans-serif',fontSize:'50px',color:soldData.soldTo?.teamColor||'hsl(45,100%,51%)',margin:'4px 0',textShadow:`0 0 30px ${soldData.soldTo?.teamColor}80`}}>{soldData.soldPriceFormatted}</motion.p>
                  <motion.p initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.5}} className="text-foreground/90 text-xl" style={{fontFamily:'Rajdhani,sans-serif'}}>to <span className="font-bold" style={{color:soldData.soldTo?.teamColor}}>{soldData.soldTo?.teamName}</span></motion.p>
                  {rtmEnabled&&<motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.8}} className="text-primary text-sm mt-4 animate-pulse" style={{fontFamily:'Rajdhani,sans-serif'}}>⏳ RTM window opening...</motion.p>}
                </div>
              </motion.div>
            )}
            {unsoldPlayer&&!soldData&&(
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                className="absolute inset-0 z-20 flex items-center justify-center"
                style={{background:'hsl(222 47% 5%)',backdropFilter:'blur(4px)'}}>
                <div className="text-center">
                  <div style={{fontSize:'64px',marginBottom:'12px'}}>😔</div>
                  <h2 style={{fontFamily:'Oswald,sans-serif',fontSize:'60px',color:'hsl(220,15%,55%)'}}>UNSOLD</h2>
                  <p className="text-foreground text-xl" style={{fontFamily:'Oswald,sans-serif'}}>{unsoldPlayer.name}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* IDLE */}
          {(auctionStatus==='draft'||auctionStatus==='idle')&&!isOrganizer&&(
            <div className="text-center px-6 relative z-10">
              <motion.div animate={{scale:[1,1.04,1]}} transition={{duration:2.5,repeat:Infinity}} style={{fontSize:'72px',marginBottom:'20px'}}>🏏</motion.div>
              <h2 style={{fontFamily:'Oswald,sans-serif',fontSize:'42px',color:'hsl(45,100%,96%)'}}>AUCTION STARTING SOON</h2>
              <p className="text-muted-foreground mt-2" style={{fontFamily:'Rajdhani,sans-serif'}}>Waiting for the organizer to begin...</p>
            </div>
          )}
          {(auctionStatus==='draft'||auctionStatus==='idle')&&isOrganizer&&(
            <div className="text-center px-6 relative z-10">
              <div style={{fontSize:'64px',marginBottom:'20px'}}>🎬</div>
              <h2 style={{fontFamily:'Oswald,sans-serif',fontSize:'42px',color:'hsl(45,100%,96%)'}}>READY TO START</h2>
              <p className="text-muted-foreground mt-2 mb-5" style={{fontFamily:'Rajdhani,sans-serif'}}>{teams.length} teams joined · Click Start above</p>
              <button onClick={()=>emit('startAuction')} className="px-10 py-4 rounded-xl font-bold text-black text-lg transition-all hover:scale-[1.04]" style={{fontFamily:'Oswald,sans-serif',background:'linear-gradient(135deg,hsl(45,100%,51%),hsl(40,100%,38%))',boxShadow:'0 0 40px hsla(45,100%,51%,0.4)',letterSpacing:'2px'}}>
                ▶ START AUCTION
              </button>
            </div>
          )}
          {auctionStatus==='completed'&&(
            <div className="text-center px-6 relative z-10">
              <div style={{fontSize:'72px',marginBottom:'12px'}}>🏆</div>
              <h2 className="text-gradient-gold" style={{fontFamily:'Oswald,sans-serif',fontSize:'52px'}}>AUCTION COMPLETE!</h2>
              <p className="text-muted-foreground mt-2 mb-6" style={{fontFamily:'Rajdhani,sans-serif'}}>All players have been auctioned.</p>
              <Link href="/auctions" className="inline-block px-8 py-3 rounded-xl font-bold text-black transition-all hover:scale-[1.04]" style={{fontFamily:'Oswald,sans-serif',background:'linear-gradient(135deg,hsl(45,100%,51%),hsl(40,100%,38%))'}}>View All Auctions</Link>
            </div>
          )}

          {/* ── ACTIVE PLAYER STAGE — Professional & Realistic ── */}
          {currentPlayer&&auctionStatus!=='completed'&&(
            <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-xl px-4">
              {/* Category & role badges */}
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-heading uppercase tracking-wider border ${categoryColors[currentPlayer.category]||''}`}>{currentPlayer.category}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-heading uppercase tracking-wider border ${roleColors[currentPlayer.role]||''}`}>{roleIcons[currentPlayer.role]} {currentPlayer.role}</span>
                {currentPlayer.nationality&&<span className="px-3 py-1 rounded-full text-xs font-display border border-border/50 text-muted-foreground">{currentPlayer.nationality}</span>}
              </div>

              {/* Main player card */}
              <div className="relative flex gap-5 items-end w-full justify-center">
                {/* Timer ring — positioned left of card */}
                <div className="absolute -top-6 -right-4 z-20">
                  <svg width="108" height="108" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7"/>
                    <circle cx="55" cy="55" r="50" fill="none" strokeWidth="7" strokeLinecap="round"
                      stroke={timerColor} strokeDasharray={2*Math.PI*50} strokeDashoffset={2*Math.PI*50-(timerPct/100)*2*Math.PI*50}
                      transform="rotate(-90 55 55)" style={{transition:'stroke-dashoffset 1s linear,stroke 0.3s',filter:`drop-shadow(0 0 8px ${timerColor})`}}/>
                    <text x="55" y="50" textAnchor="middle" fill={timerColor} fontSize="24" fontFamily="Oswald,sans-serif" fontWeight="bold">{timer}</text>
                    <text x="55" y="65" textAnchor="middle" fill={timerColor} fontSize="9" fontFamily="Rajdhani,sans-serif" opacity="0.8">SEC</text>
                  </svg>
                </div>

                {/* Player photo card — cinematic style */}
                <motion.div key={currentPlayer._id} initial={{scale:0.88,opacity:0,y:20}} animate={{scale:1,opacity:1,y:0}} transition={{type:'spring',stiffness:200,damping:20}}
                  className="relative rounded-2xl overflow-hidden flex-shrink-0"
                  style={{width:'175px',height:'235px',
                    boxShadow:`0 0 0 2px hsla(45,100%,51%,0.35), 0 0 60px hsla(45,100%,51%,0.2), 0 20px 60px hsl(222 47% 5%)`,
                    background:'linear-gradient(180deg,hsl(222,35%,12%),hsl(222,47%,6%))',
                  }}>
                  {currentPlayer.imageUrl
                    ?<img src={imgUrl(currentPlayer.imageUrl)} alt={currentPlayer.name} className="w-full h-full object-cover object-top"/>
                    :<div className="w-full h-full flex items-center justify-center" style={{background:'linear-gradient(135deg,hsl(222,35%,14%),hsl(222,47%,8%))'}}>
                      <span style={{fontSize:'72px'}}>{roleIcons[currentPlayer.role]}</span>
                    </div>}
                  {/* Gradient overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0" style={{height:'55%',background:'linear-gradient(to top,rgba(0,0,0,0.97) 0%,rgba(0,0,0,0.7) 50%,transparent 100%)'}}/>
                  {/* Gold top edge */}
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{background:'linear-gradient(90deg,transparent,hsl(45,100%,51%),transparent)'}}/>
                  {/* Player name at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 text-center pb-3 px-2">
                    <div className="text-foreground font-bold leading-tight" style={{fontFamily:'Oswald,sans-serif',fontSize:'17px',textShadow:'0 2px 8px rgba(0,0,0,0.9)'}}>{currentPlayer.name}</div>
                    <div className="text-muted-foreground" style={{fontSize:'10px',fontFamily:'Rajdhani,sans-serif'}}>{currentPlayer.nationality}{currentPlayer.age?` · Age ${currentPlayer.age}`:''}</div>
                  </div>
                </motion.div>

                {/* Stats panel — right of player card */}
                <div className="flex flex-col gap-2 min-w-[120px]">
                  {/* Bid amount — large */}
                  <div className={`text-center rounded-xl p-3 transition-all ${bidFlash?'scale-105':''}`}
                    style={{background:'hsla(222,35%,10%,0.9)',border:`2px solid ${leadingTeamId?leadingTeamColor+'60':'hsla(45,100%,51%,0.3)'}`,boxShadow:leadingTeamId?`0 0 30px ${leadingTeamColor}30`:undefined}}>
                    <div className="text-muted-foreground uppercase mb-1" style={{fontSize:'9px',fontFamily:'Oswald,sans-serif',letterSpacing:'2px'}}>{leadingTeamId?'HIGHEST BID':'BASE PRICE'}</div>
                    <motion.div key={currentBid} initial={{scale:0.85}} animate={{scale:1}}
                      style={{fontFamily:'Oswald,sans-serif',fontSize:'26px',fontWeight:'bold',color:leadingTeamId?leadingTeamColor:'hsl(45,100%,51%)',letterSpacing:'1px',lineHeight:1}}>
                      {currentBidFmt||fmt(currentPlayer.basePrice)}
                    </motion.div>
                    {leadingTeamId&&<div className="font-bold mt-1 truncate" style={{fontFamily:'Rajdhani,sans-serif',fontSize:'12px',color:leadingTeamColor}}>👑 {leadingTeamName}</div>}
                  </div>
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {currentPlayer.stats?.matches>0&&<div className="rounded-lg p-2 text-center" style={{background:'hsla(222,35%,10%,0.8)',border:'1px solid hsla(255,255,255,0.07)'}}><div className="text-primary font-bold text-sm" style={{fontFamily:'Oswald,sans-serif'}}>{currentPlayer.stats.matches}</div><div className="text-muted-foreground" style={{fontSize:'9px',fontFamily:'Rajdhani,sans-serif'}}>MATCHES</div></div>}
                    {currentPlayer.role!=='Bowler'&&currentPlayer.stats?.runs>0&&<div className="rounded-lg p-2 text-center" style={{background:'hsla(222,35%,10%,0.8)',border:'1px solid hsla(255,255,255,0.07)'}}><div className="text-primary font-bold text-sm" style={{fontFamily:'Oswald,sans-serif'}}>{currentPlayer.stats.runs}</div><div className="text-muted-foreground" style={{fontSize:'9px',fontFamily:'Rajdhani,sans-serif'}}>RUNS</div></div>}
                    {currentPlayer.role!=='Batsman'&&currentPlayer.stats?.wickets>0&&<div className="rounded-lg p-2 text-center" style={{background:'hsla(222,35%,10%,0.8)',border:'1px solid hsla(255,255,255,0.07)'}}><div className="text-primary font-bold text-sm" style={{fontFamily:'Oswald,sans-serif'}}>{currentPlayer.stats.wickets}</div><div className="text-muted-foreground" style={{fontSize:'9px',fontFamily:'Rajdhani,sans-serif'}}>WICKETS</div></div>}
                    {currentPlayer.stats?.average>0&&<div className="rounded-lg p-2 text-center" style={{background:'hsla(222,35%,10%,0.8)',border:'1px solid hsla(255,255,255,0.07)'}}><div className="text-primary font-bold text-sm" style={{fontFamily:'Oswald,sans-serif'}}>{Number(currentPlayer.stats.average).toFixed(1)}</div><div className="text-muted-foreground" style={{fontSize:'9px',fontFamily:'Rajdhani,sans-serif'}}>AVG</div></div>}
                    {currentPlayer.stats?.strikeRate>0&&<div className="rounded-lg p-2 text-center" style={{background:'hsla(222,35%,10%,0.8)',border:'1px solid hsla(255,255,255,0.07)'}}><div className="text-primary font-bold text-sm" style={{fontFamily:'Oswald,sans-serif'}}>{Number(currentPlayer.stats.strikeRate).toFixed(1)}</div><div className="text-muted-foreground" style={{fontSize:'9px',fontFamily:'Rajdhani,sans-serif'}}>SR</div></div>}
                    {currentPlayer.stats?.economy>0&&<div className="rounded-lg p-2 text-center" style={{background:'hsla(222,35%,10%,0.8)',border:'1px solid hsla(255,255,255,0.07)'}}><div className="text-primary font-bold text-sm" style={{fontFamily:'Oswald,sans-serif'}}>{Number(currentPlayer.stats.economy).toFixed(2)}</div><div className="text-muted-foreground" style={{fontSize:'9px',fontFamily:'Rajdhani,sans-serif'}}>ECO</div></div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="w-64 xl:w-72 flex-shrink-0 border-l border-border/40 flex flex-col" style={{background:'hsla(222,42%,7%,0.97)'}}>
          <div className="p-3 border-b border-border/40 space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest" style={{fontFamily:'Oswald,sans-serif'}}>{isOrganizer?'Auction Control':'Bid Controls'}</h3>

            {/* Organizer view */}
            {isOrganizer&&(
              <div className="rounded-xl p-4 text-center" style={{background:'hsla(45,100%,51%,0.06)',border:'1px solid hsla(45,100%,51%,0.2)'}}>
                <div style={{fontSize:'26px',marginBottom:'8px'}}>🎬</div>
                <div className="text-foreground font-bold text-sm" style={{fontFamily:'Oswald,sans-serif'}}>ORGANIZER VIEW</div>
                <div className="text-muted-foreground text-xs mt-1" style={{fontFamily:'Rajdhani,sans-serif'}}>Controls in top bar</div>
                {currentPlayer&&<div className="mt-3 pt-3 border-t border-border text-xs text-foreground font-bold" style={{fontFamily:'Rajdhani,sans-serif'}}>{currentPlayer.name}</div>}
              </div>
            )}

            {/* Team owner bid button */}
            {isTeamOwner&&myTeam&&(
              <>
                <div className="rounded-xl p-3" style={{background:`${myTeam.primaryColor}10`,border:`1px solid ${myTeam.primaryColor}30`}}>
                  <div className="flex items-center gap-2 mb-2">
                    {myTeam.logo?<img src={imgUrl(myTeam.logo)} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0"/>
                      :<div className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-bold flex-shrink-0" style={{background:myTeam.primaryColor,fontFamily:'Oswald,sans-serif',fontSize:'12px'}}>{myTeam.shortName?.slice(0,2)}</div>}
                    <div>
                      <div className="text-foreground text-sm font-bold" style={{fontFamily:'Rajdhani,sans-serif'}}>{myTeam.name}</div>
                      <div className="text-muted-foreground" style={{fontSize:'10px',fontFamily:'Oswald,sans-serif'}}>YOUR TEAM</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-primary font-bold text-xl" style={{fontFamily:'Oswald,sans-serif'}}>{fmt(myTeam.purse)}</div>
                      <div className="text-muted-foreground" style={{fontSize:'10px',fontFamily:'Rajdhani,sans-serif'}}>remaining</div>
                    </div>
                    {rtmEnabled&&<div className="text-right"><div className="font-bold text-sm" style={{color:'hsl(45,100%,51%)',fontFamily:'Oswald,sans-serif'}}>🎯 {rtmRemaining}</div><div className="text-muted-foreground" style={{fontSize:'10px'}}>RTM</div></div>}
                  </div>
                  <div className="w-full bg-secondary/20 rounded-full mt-2 overflow-hidden" style={{height:'3px'}}>
                    <div className="h-full rounded-full" style={{width:`${(myTeam.purse/myTeam.initialPurse)*100}%`,background:myTeam.primaryColor}}/>
                  </div>
                </div>

                {canBid&&(
                  <motion.button onClick={placeBid} whileHover={{scale:1.03}} whileTap={{scale:0.96}}
                    className="w-full py-5 rounded-xl font-bold text-black relative overflow-hidden"
                    style={{fontFamily:'Oswald,sans-serif',fontSize:'22px',letterSpacing:'1px',
                      background:`linear-gradient(135deg,${myTeam.primaryColor},${myTeam.primaryColor}bb)`,
                      boxShadow:`0 0 30px ${myTeam.primaryColor}60,0 4px 20px rgba(0,0,0,0.5)`}}>
                    <span className="relative z-10">BID {fmt(currentBid+bidConfig.bidIncrement)}</span>
                    <motion.div animate={{x:['-100%','100%']}} transition={{duration:1.6,repeat:Infinity}}
                      className="absolute inset-0 opacity-20" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)'}}/>
                  </motion.button>
                )}
                {isLeading&&(
                  <div className="w-full py-4 rounded-xl border-2 text-center relative overflow-hidden"
                    style={{borderColor:myTeam.primaryColor,background:`${myTeam.primaryColor}12`}}>
                    <div className="font-bold" style={{fontFamily:'Oswald,sans-serif',color:myTeam.primaryColor,fontSize:'18px',letterSpacing:'1px'}}>👑 YOU'RE LEADING!</div>
                    <div className="text-muted-foreground text-xs mt-0.5" style={{fontFamily:'Rajdhani,sans-serif'}}>Waiting for rival bid...</div>
                  </div>
                )}
                {!canBid&&!isLeading&&currentPlayer&&auctionStatus==='active'&&timer>0&&(
                  <div className="text-center py-3">
                    {myTeam.purse<currentBid+bidConfig.bidIncrement
                      ?<p className="text-red-400 text-xs font-bold" style={{fontFamily:'Rajdhani,sans-serif'}}>⚠️ Insufficient purse</p>
                      :<p className="text-muted-foreground text-xs" style={{fontFamily:'Rajdhani,sans-serif'}}>Waiting for bid opportunity...</p>}
                  </div>
                )}
                {auctionStatus==='paused'&&(
                  <div className="text-center py-3 rounded-xl" style={{background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.2)'}}>
                    <p className="text-yellow-400 text-xs font-bold" style={{fontFamily:'Oswald,sans-serif'}}>⏸ AUCTION PAUSED</p>
                  </div>
                )}
              </>
            )}

            {isTeamOwner&&!myTeam&&(
              <div className="text-center py-6 rounded-xl" style={{background:'hsla(222,30%,12%,0.5)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <div style={{fontSize:'28px',marginBottom:'8px'}}>🏆</div>
                <p className="text-muted-foreground text-xs font-semibold" style={{fontFamily:'Rajdhani,sans-serif'}}>No team in this auction</p>
                <Link href="/dashboard/team-owner" className="text-primary text-xs hover:underline mt-1 block" style={{fontFamily:'Rajdhani,sans-serif'}}>Join with a code →</Link>
              </div>
            )}
            {!isOrganizer&&!isTeamOwner&&(
              <div className="text-center py-4 rounded-xl" style={{background:'hsla(222,30%,12%,0.4)',border:'1px solid rgba(255,255,255,0.05)'}}>
                <p className="text-muted-foreground text-xs" style={{fontFamily:'Rajdhani,sans-serif'}}>👁️ Viewing live</p>
              </div>
            )}
          </div>

          {/* BID HISTORY */}
          <div className="flex-1 overflow-hidden flex flex-col p-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2" style={{fontFamily:'Oswald,sans-serif'}}>Bid History</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              <AnimatePresence mode="popLayout">
                {bidHistory.map((b,i)=>(
                  <motion.div key={`${b.teamId}-${b.timestamp}`}
                    initial={{opacity:0,x:20,scale:0.95}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0}}
                    className="rounded-lg p-2.5 border"
                    style={{borderColor:i===0?`${b.teamColor}50`:'rgba(255,255,255,0.06)',background:i===0?`${b.teamColor}0a`:'hsla(222,30%,10%,0.5)'}}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-black flex-shrink-0" style={{background:b.teamColor,fontFamily:'Oswald,sans-serif',fontSize:'10px'}}>{b.teamShortName?.slice(0,2)}</div>
                        <span className="text-foreground text-xs font-semibold truncate max-w-20" style={{fontFamily:'Rajdhani,sans-serif'}}>{b.teamName}</span>
                      </div>
                      <span className="text-primary font-bold text-xs flex-shrink-0" style={{fontFamily:'Oswald,sans-serif'}}>{b.bidAmountFormatted}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {bidHistory.length===0&&<p className="text-muted-foreground/60 text-xs text-center py-6" style={{fontFamily:'Rajdhani,sans-serif'}}>No bids yet</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
