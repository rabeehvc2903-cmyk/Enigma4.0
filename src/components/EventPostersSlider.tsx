import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { festStore } from '../lib/store';

export const EventPostersSlider: React.FC = () => {
  const [posters, setPosters] = useState(festStore.getEventPosters());
  
  // To implement seamless looping, we create an extended list if we have > 1 posters:
  // [Last_Clone, ...Originals, First_Clone]
  const hasMultiple = posters.length > 1;
  const extendedPosters = hasMultiple
    ? [posters[posters.length - 1], ...posters, posters[0]]
    : posters;

  // Start at index 1 (the first real slide) if multiple posters exist
  const [currentIndex, setCurrentIndex] = useState(hasMultiple ? 1 : 0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state on store updates
  useEffect(() => {
    const unsubscribe = festStore.subscribe(() => {
      const newPosters = festStore.getEventPosters();
      setPosters(newPosters);
      setCurrentIndex(newPosters.length > 1 ? 1 : 0);
      setIsTransitioning(true);
    });
    return unsubscribe;
  }, []);

  // Automatic sliding to the right with a 5-second delay
  useEffect(() => {
    if (!hasMultiple) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      handleNext();
    }, 5000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [posters.length, currentIndex]);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 40;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasMultiple) return;
    
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev - 1);
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasMultiple) return;

    setIsTransitioning(true);
    setCurrentIndex((prev) => prev + 1);
  };

  // Handle transition end to snap back/forward invisibly
  const handleTransitionEnd = () => {
    if (!hasMultiple) return;

    // If we moved past the last original slide to the cloned first slide (at the end)
    if (currentIndex >= extendedPosters.length - 1) {
      setIsTransitioning(false); // Disable transition animation
      setCurrentIndex(1); // Jump to first real slide
    }
    // If we moved before the first original slide to the cloned last slide (at the start)
    else if (currentIndex <= 0) {
      setIsTransitioning(false); // Disable transition animation
      setCurrentIndex(extendedPosters.length - 2); // Jump to last real slide
    }
  };

  if (posters.length === 0) {
    return null;
  }

  // Calculate actual dot index
  let activeDotIndex = 0;
  if (hasMultiple) {
    if (currentIndex === 0) {
      activeDotIndex = posters.length - 1;
    } else if (currentIndex === extendedPosters.length - 1) {
      activeDotIndex = 0;
    } else {
      activeDotIndex = currentIndex - 1;
    }
  }

  return (
    <div id="landscape-posters-section">
      <div className="relative group rounded-xl overflow-hidden border border-[#2a2d3d] bg-[#12141d] shadow-2xl">
        {/* Slider Container */}
        <div 
          className="relative aspect-[16/7] sm:aspect-[21/9] md:aspect-[21/8] w-full overflow-hidden touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div 
            className={`flex h-full w-full ${isTransitioning ? 'transition-transform duration-700 ease-out' : ''}`}
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            onTransitionEnd={handleTransitionEnd}
          >
            {extendedPosters.map((poster, index) => (
              <div 
                key={`${poster.id}-${index}`} 
                className="w-full h-full shrink-0 relative"
              >
                <img 
                  src={poster.url} 
                  alt={`Event Poster ${index}`} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {/* Visual Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
              </div>
            ))}
          </div>

          {/* Manual Left Arrow */}
          {hasMultiple && (
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-purple-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg"
              aria-label="Previous Slide"
              id="poster-prev-btn"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Manual Right Arrow */}
          {hasMultiple && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-purple-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg"
              aria-label="Next Slide"
              id="poster-next-btn"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Bottom Dot Indicators */}
          {hasMultiple && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {posters.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsTransitioning(true);
                    setCurrentIndex(idx + 1);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === activeDotIndex 
                      ? 'bg-purple-500 w-5' 
                      : 'bg-white/40 hover:bg-white/80'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                  id={`poster-indicator-${idx}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
