export interface Track {
  uri: string;
  title: string;
  artist: string;
  albumArt: string;
  addedBy: string;
}

export interface DJ {
  userId: string;
  queue: Track[];
}

export class Rotation {
  private djs: DJ[] = [];
  private currentIndex = 0;
  private currentTrack: Track | null = null;
  private votes = { fire: new Set<string>(), skip: new Set<string>() };

  join(userId: string): boolean {
    if (this.djs.some(dj => dj.userId === userId)) return false;
    this.djs.push({ userId, queue: [] });
    return true;
  }

  leave(userId: string): boolean {
    const index = this.djs.findIndex(dj => dj.userId === userId);
    if (index === -1) return false;
    this.djs.splice(index, 1);
    if (this.djs.length === 0) {
      this.currentIndex = 0;
    } else if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (this.currentIndex >= this.djs.length) {
      this.currentIndex = 0;
    }
    return true;
  }

  getDJs(): readonly DJ[] {
    return this.djs;
  }

  getCurrentDJ(): DJ | null {
    return this.djs[this.currentIndex] ?? null;
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  getVotes(): { fire: number; skip: number } {
    return { fire: this.votes.fire.size, skip: this.votes.skip.size };
  }

  addTrack(userId: string, track: Track): void {
    const dj = this.djs.find(d => d.userId === userId);
    if (!dj) return;
    dj.queue.push(track);
  }

  removeTrack(userId: string, index: number): Track | null {
    const dj = this.djs.find(d => d.userId === userId);
    if (!dj || index < 0 || index >= dj.queue.length) return null;
    return dj.queue.splice(index, 1)[0];
  }

  getQueue(userId: string): readonly Track[] {
    const dj = this.djs.find(d => d.userId === userId);
    return dj?.queue ?? [];
  }

  advance(): Track | null {
    this.votes = { fire: new Set(), skip: new Set() };
    const djCount = this.djs.length;
    if (djCount === 0) {
      this.currentTrack = null;
      return null;
    }
    for (let i = 0; i < djCount; i++) {
      const idx = (this.currentIndex + i) % djCount;
      const dj = this.djs[idx];
      if (dj.queue.length > 0) {
        this.currentTrack = dj.queue.shift()!;
        this.currentIndex = (idx + 1) % djCount;
        return this.currentTrack;
      }
    }
    this.currentTrack = null;
    return null;
  }

  voteFire(userId: string): boolean {
    if (this.votes.fire.has(userId)) return false;
    this.votes.fire.add(userId);
    return true;
  }

  voteSkip(userId: string): boolean {
    if (this.votes.skip.has(userId)) return false;
    this.votes.skip.add(userId);
    return this.shouldSkip();
  }

  private shouldSkip(): boolean {
    if (this.djs.length === 0) return false;
    return this.votes.skip.size > this.djs.length / 2;
  }
}
