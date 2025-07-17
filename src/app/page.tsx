'use client'

import FullScene from "@/components/FullScene";
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [audioState, setAudioState] = useState<'stopped' | 'playing' | 'paused'>('stopped');

  let buttonLabel = 'Iniciar Áudio';
  if (audioState === 'playing') buttonLabel = 'Pausar';
  if (audioState === 'paused') buttonLabel = 'Retomar';

  let buttonIcon = null;
  if (audioState === 'playing') {
    buttonIcon = (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="5" width="5" height="18" rx="2" fill="#fff"/>
        <rect x="17" y="5" width="5" height="18" rx="2" fill="#fff"/>
      </svg>
    );
  } else {
    buttonIcon = (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="rgba(0,0,0,0.15)"/>
        <polygon points="13,10 24,16 13,22" fill="#fff"/>
      </svg>
    );
  }

  function handleButtonClick() {
    if (audioState === 'stopped') setAudioState('playing');
    else if (audioState === 'playing') setAudioState('paused');
    else if (audioState === 'paused') setAudioState('playing');
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto absolute inset-0 z-30 py-24">
        <div className="flex flex-col gap-4  w-full h-full relative justify-between">
      <div className="flex flex-col gap-1 ">

      <h1 className="text-7xl font-bold -ml-1 ">SoundPillards</h1>
      <p className="text-lg ">Just feel the music and look at the pillards.</p> 
      </div>
      <span>Developed by <span className="font-bold">Marllon Ramos</span></span>
      <button
        className=" absolute bottom-0 right-0  z-40 w-12 h-12 rounded-full border-2 border-[#d441ff] shadow-none cursor-pointer flex items-center justify-center p-0 transition-colors duration-200"
        onClick={handleButtonClick}
        aria-label={audioState === 'playing' ? 'Pausar áudio' : 'Tocar áudio'}
        >
        {buttonIcon}
      </button>
          </div>
        </div>
      <FullScene audioState={audioState} />
    </div>
  );
}
