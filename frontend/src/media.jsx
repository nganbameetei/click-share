import { ExternalLink, Play } from 'lucide-react';
import { PLATFORMS } from './ui';

/**
 * Turn a social link into the platform's official embed (public posts only).
 * Returns null when the link can't be embedded (e.g. an Instagram profile).
 */
export function mediaFor(platform, url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const path = u.pathname;

  if (platform === 'youtube') {
    let id = null;
    let vertical = false;
    if (host === 'youtu.be') id = path.slice(1).split('/')[0];
    else if (u.searchParams.get('v')) id = u.searchParams.get('v');
    else {
      const m = path.match(/^\/(shorts|embed|live|v)\/([\w-]{6,})/);
      if (m) { id = m[2]; vertical = m[1] === 'shorts'; }
    }
    if (!id || !/^[\w-]{6,}$/.test(id)) return null; // channel link etc.
    return {
      kind: 'iframe',
      src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      ratio: vertical ? '9 / 16' : '16 / 9',
      vertical,
    };
  }

  if (platform === 'instagram') {
    const m = path.match(/^\/(p|reel|reels|tv)\/([\w-]+)/);
    if (!m) return null; // profile link: Instagram has no profile embed
    const type = m[1] === 'reels' ? 'reel' : m[1];
    return { kind: 'iframe', src: `https://www.instagram.com/${type}/${m[2]}/embed/captioned/`, height: 620, vertical: true };
  }

  if (platform === 'facebook') {
    const href = encodeURIComponent(url);
    const isVideo = host === 'fb.watch' || /\/(videos|watch|reel)\b/.test(path) || u.searchParams.has('v');
    if (isVideo) return { kind: 'iframe', src: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=400`, ratio: '16 / 9' };
    const isPost = /\/(posts|photos|permalink|story\.php|share\/p|photo)/.test(path) || u.searchParams.has('story_fbid') || u.searchParams.has('fbid');
    if (isPost) return { kind: 'iframe', src: `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=400`, height: 560 };
    // Page link (follow tasks): the Page plugin shows the page header + latest posts
    return { kind: 'iframe', src: `https://www.facebook.com/plugins/page.php?href=${href}&tabs=timeline&width=400&height=440&small_header=false&hide_cover=false`, height: 460 };
  }
  return null;
}

/** Fallback when there is nothing to embed. */
function LinkCard({ platform, url, compact }) {
  const p = PLATFORMS[platform];
  let label = url;
  try { const u = new URL(url); label = u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, ''); } catch { /* keep */ }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-xl ${p.tile} p-4 text-white ${compact ? 'h-full' : ''}`}>
      <p.Icon className="h-8 w-8 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-bold">Open on {p.label}</div>
        <div className="truncate text-xs text-white/80">{label}</div>
      </div>
      <ExternalLink size={16} className="ml-auto shrink-0" />
    </a>
  );
}

/**
 * compact = small preview for task cards (not interactive, cheap to load).
 * Otherwise the full, playable embed.
 */
export function MediaPreview({ platform, url, compact = false, className = '' }) {
  const m = mediaFor(platform, url);
  const p = PLATFORMS[platform];

  if (compact) {
    return (
      <div className={`relative h-44 overflow-hidden rounded-xl bg-black/40 ${className}`}>
        {!m ? (
          <div className={`grid h-full place-items-center ${p.tile} opacity-90`}><p.Icon className="h-14 w-14 text-white" /></div>
        ) : m.thumb ? (
          <img src={m.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          // Instagram / Facebook have no public thumbnail URL: show the top of the real embed
          <iframe src={m.src} title={`${p.label} preview`} loading="lazy" scrolling="no" tabIndex={-1}
            className="pointer-events-none h-[420px] w-full origin-top border-0 bg-white" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />
        {m?.thumb && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-black/60 backdrop-blur"><Play size={22} className="ml-0.5 text-white" fill="white" /></div>
          </div>
        )}
        {m && (
          <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <p.Icon className="h-3.5 w-3.5" /> Tap to view
          </span>
        )}
      </div>
    );
  }

  if (!m) return <LinkCard platform={platform} url={url} />;
  const style = m.ratio ? { aspectRatio: m.ratio } : { height: m.height };
  return (
    <div className={className}>
      <div className={`overflow-hidden rounded-xl bg-white ${m.vertical && m.ratio ? 'mx-auto max-w-[280px]' : ''}`} style={style}>
        <iframe src={m.src} title={`${p.label} post`} loading="lazy" className="h-full w-full border-0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen />
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
        Can't see it? Open on {p.label} <ExternalLink size={12} />
      </a>
    </div>
  );
}
