// ════════════════════════════════════════════════════════════════════════════
// PLAYER CARD COMPONENT - WITH IMAGE DISPLAY FIX
// ════════════════════════════════════════════════════════════════════════════
// FILE PATH: bca-fixed/bca/client/components/PlayerCard.tsx
// CREATE THIS FILE OR REPLACE EXISTING ONE
// ════════════════════════════════════════════════════════════════════════════

'use client';

import React, { useState } from 'react';
import { FiUser, FiDollarSign, FiTrendingUp } from 'react-icons/fi';

// ═══ Helper function to resolve image URLs ═══════════════════════════════════
const getPlayerImageUrl = (imageUrl: string | null | undefined): string => {
  // If no image, return default
  if (!imageUrl) {
    return '/default-player.png'; // Make sure you have this in public folder
  }
  
  // If it's already a full URL (Cloudinary), return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it's a local path, prepend backend URL
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  
  // Ensure the path starts with /
  const normalizedPath = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  
  return `${backendUrl}${normalizedPath}`;
};

// ═══ Player Card Component ═══════════════════════════════════════════════════
interface PlayerCardProps {
  player: {
    _id: string;
    name: string;
    role: string;
    category: string;
    nationality?: string;
    age?: number;
    basePrice: number;
    imageUrl?: string | null;
    status: string;
    stats?: {
      matches?: number;
      runs?: number;
      wickets?: number;
      average?: number;
      strikeRate?: number;
      economy?: number;
    };
    teamId?: {
      name: string;
      shortName: string;
      primaryColor: string;
    } | null;
    soldPrice?: number;
  };
  onSelect?: (player: any) => void;
  isSelected?: boolean;
  showTeam?: boolean;
}

export default function PlayerCard({ player, onSelect, isSelected, showTeam = true }: PlayerCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Get the image URL
  const imageUrl = getPlayerImageUrl(player.imageUrl);

  // Handle image load error
  const handleImageError = () => {
    console.warn(`Failed to load image for player: ${player.name}`);
    setImageError(true);
    setImageLoading(false);
  };

  // Handle image load success
  const handleImageLoad = () => {
    setImageLoading(false);
    console.log(`✅ Image loaded successfully for: ${player.name}`);
  };

  // Category colors
  const categoryColors: Record<string, string> = {
    Elite: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Gold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Silver: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
    Emerging: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  // Status colors
  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    sold: 'bg-blue-500/20 text-blue-400',
    unsold: 'bg-red-500/20 text-red-400',
  };

  // Format price
  const formatPrice = (price: number) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(1)}Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(1)}L`;
    return `₹${price.toLocaleString()}`;
  };

  return (
    <div
      onClick={() => onSelect?.(player)}
      className={`
        bg-gray-800/50 rounded-xl border-2 overflow-hidden cursor-pointer
        transition-all duration-300 hover:shadow-xl hover:scale-[1.02]
        ${isSelected ? 'border-yellow-500 ring-2 ring-yellow-500/50' : 'border-gray-700 hover:border-gray-600'}
      `}
    >
      {/* ═══ Player Image Section ═══════════════════════════════════ */}
      <div className="relative h-48 bg-gray-900 overflow-hidden">
        {/* Loading State */}
        {imageLoading && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
          </div>
        )}

        {/* Image or Fallback */}
        {!imageError ? (
          <img
            src={imageUrl}
            alt={player.name}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onError={handleImageError}
            onLoad={handleImageLoad}
            loading="lazy"
          />
        ) : (
          // Fallback when image fails
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="text-center">
              <FiUser className="mx-auto mb-2 text-gray-600" size={48} />
              <p className="text-gray-500 text-sm">No Image</p>
            </div>
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className={`
            px-3 py-1 rounded-full text-xs font-bold border
            ${categoryColors[player.category] || categoryColors.Silver}
          `}>
            {player.category}
          </span>
        </div>

        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <span className={`
            px-3 py-1 rounded-full text-xs font-bold uppercase
            ${statusColors[player.status] || statusColors.active}
          `}>
            {player.status}
          </span>
        </div>

        {/* Team Badge (if sold) */}
        {showTeam && player.teamId && player.status === 'sold' && (
          <div 
            className="absolute bottom-0 left-0 right-0 py-2 px-3 text-center font-bold text-white text-sm"
            style={{ backgroundColor: player.teamId.primaryColor || '#f59e0b' }}
          >
            {player.teamId.shortName || player.teamId.name}
          </div>
        )}
      </div>

      {/* ═══ Player Info Section ════════════════════════════════════ */}
      <div className="p-4">
        {/* Name and Role */}
        <div className="mb-3">
          <h3 className="text-lg font-bold text-white mb-1 truncate">
            {player.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="font-medium text-yellow-400">{player.role}</span>
            {player.nationality && (
              <>
                <span>•</span>
                <span>{player.nationality}</span>
              </>
            )}
            {player.age && (
              <>
                <span>•</span>
                <span>{player.age}y</span>
              </>
            )}
          </div>
        </div>

        {/* Price Info */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Base Price</p>
            <p className="text-lg font-bold text-white flex items-center gap-1">
              <FiDollarSign className="text-green-400" size={16} />
              {formatPrice(player.basePrice)}
            </p>
          </div>
          
          {player.soldPrice && player.soldPrice > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Sold At</p>
              <p className="text-lg font-bold text-green-400 flex items-center gap-1">
                <FiTrendingUp size={16} />
                {formatPrice(player.soldPrice)}
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        {player.stats && (
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-700">
            {player.stats.matches && player.stats.matches > 0 && (
              <div className="text-center">
                <p className="text-xs text-gray-500">Matches</p>
                <p className="text-sm font-bold text-white">{player.stats.matches}</p>
              </div>
            )}
            
            {player.role.includes('Batsman') || player.role.includes('All-rounder') ? (
              <>
                {player.stats.runs !== undefined && player.stats.runs > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Runs</p>
                    <p className="text-sm font-bold text-white">{player.stats.runs}</p>
                  </div>
                )}
                {player.stats.strikeRate !== undefined && player.stats.strikeRate > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500">SR</p>
                    <p className="text-sm font-bold text-white">{player.stats.strikeRate.toFixed(1)}</p>
                  </div>
                )}
              </>
            ) : null}
            
            {player.role.includes('Bowler') || player.role.includes('All-rounder') ? (
              <>
                {player.stats.wickets !== undefined && player.stats.wickets > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Wickets</p>
                    <p className="text-sm font-bold text-white">{player.stats.wickets}</p>
                  </div>
                )}
                {player.stats.economy !== undefined && player.stats.economy > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Economy</p>
                    <p className="text-sm font-bold text-white">{player.stats.economy.toFixed(2)}</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Debug Info (Remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 pb-2 text-xs text-gray-600">
          <details>
            <summary className="cursor-pointer hover:text-gray-400">Debug Info</summary>
            <div className="mt-2 space-y-1">
              <p>Image URL: {player.imageUrl || 'null'}</p>
              <p>Resolved: {imageUrl}</p>
              <p>Status: {player.status}</p>
              <p>Error: {imageError ? 'Yes' : 'No'}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ═══ Export helper function for use in other components ═════════════════════
export { getPlayerImageUrl };
