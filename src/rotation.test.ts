import { describe, it, expect, beforeEach } from 'vitest';
import { Rotation } from './rotation.js';

describe('Rotation', () => {
  let rotation: Rotation;

  beforeEach(() => {
    rotation = new Rotation();
  });

  describe('join/leave', () => {
    it('should add a DJ to the rotation', () => {
      const result = rotation.join('user-1');
      expect(result).toBe(true);
      expect(rotation.getDJs()).toHaveLength(1);
      expect(rotation.getDJs()[0].userId).toBe('user-1');
    });

    it('should not add the same DJ twice', () => {
      rotation.join('user-1');
      const result = rotation.join('user-1');
      expect(result).toBe(false);
      expect(rotation.getDJs()).toHaveLength(1);
    });

    it('should remove a DJ from the rotation', () => {
      rotation.join('user-1');
      rotation.join('user-2');
      const result = rotation.leave('user-1');
      expect(result).toBe(true);
      expect(rotation.getDJs()).toHaveLength(1);
      expect(rotation.getDJs()[0].userId).toBe('user-2');
    });

    it('should return false when removing a non-existent DJ', () => {
      const result = rotation.leave('user-1');
      expect(result).toBe(false);
    });

    it('should adjust currentIndex when removing a DJ before it', () => {
      rotation.join('user-1');
      rotation.join('user-2');
      rotation.join('user-3');
      rotation.addTrack('user-1', { uri: 'a', title: 'A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-2', { uri: 'b', title: 'B', artist: 'B', albumArt: '', addedBy: 'user-2' });
      rotation.advance();
      rotation.leave('user-1');
      expect(rotation.getDJs().map(d => d.userId)).toEqual(['user-2', 'user-3']);
    });
  });

  describe('queue management', () => {
    it('should add tracks to a DJ queue', () => {
      rotation.join('user-1');
      rotation.addTrack('user-1', { uri: 'spotify:track:1', title: 'Song A', artist: 'Artist A', albumArt: 'https://img/a', addedBy: 'user-1' });
      expect(rotation.getQueue('user-1')).toHaveLength(1);
      expect(rotation.getQueue('user-1')[0].title).toBe('Song A');
    });

    it('should ignore addTrack for non-DJ users', () => {
      rotation.addTrack('user-1', { uri: 'spotify:track:1', title: 'Song A', artist: 'Artist A', albumArt: '', addedBy: 'user-1' });
      expect(rotation.getQueue('user-1')).toHaveLength(0);
    });

    it('should remove tracks by index', () => {
      rotation.join('user-1');
      rotation.addTrack('user-1', { uri: 'a', title: 'A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-1', { uri: 'b', title: 'B', artist: 'B', albumArt: '', addedBy: 'user-1' });
      const removed = rotation.removeTrack('user-1', 0);
      expect(removed?.title).toBe('A');
      expect(rotation.getQueue('user-1')).toHaveLength(1);
    });

    it('should return null when removing invalid index', () => {
      rotation.join('user-1');
      expect(rotation.removeTrack('user-1', 5)).toBeNull();
    });
  });

  describe('advance', () => {
    it('should play tracks round-robin across DJs', () => {
      rotation.join('user-1');
      rotation.join('user-2');
      rotation.addTrack('user-1', { uri: 'a', title: 'Song A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-1', { uri: 'c', title: 'Song C', artist: 'C', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-2', { uri: 'b', title: 'Song B', artist: 'B', albumArt: '', addedBy: 'user-2' });

      const first = rotation.advance();
      expect(first?.title).toBe('Song A');
      const second = rotation.advance();
      expect(second?.title).toBe('Song B');
      const third = rotation.advance();
      expect(third?.title).toBe('Song C');
    });

    it('should skip DJs with empty queues', () => {
      rotation.join('user-1');
      rotation.join('user-2');
      rotation.addTrack('user-2', { uri: 'b', title: 'Song B', artist: 'B', albumArt: '', addedBy: 'user-2' });
      const track = rotation.advance();
      expect(track?.title).toBe('Song B');
    });

    it('should return null when all queues are empty', () => {
      rotation.join('user-1');
      expect(rotation.advance()).toBeNull();
    });

    it('should return null when no DJs', () => {
      expect(rotation.advance()).toBeNull();
    });

    it('should reset votes on advance', () => {
      rotation.join('user-1');
      rotation.addTrack('user-1', { uri: 'a', title: 'A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.addTrack('user-1', { uri: 'b', title: 'B', artist: 'B', albumArt: '', addedBy: 'user-1' });
      rotation.advance();
      rotation.voteFire('user-1');
      rotation.advance();
      expect(rotation.getVotes()).toEqual({ fire: 0, skip: 0 });
    });
  });

  describe('voting', () => {
    beforeEach(() => {
      rotation.join('user-1');
      rotation.join('user-2');
      rotation.join('user-3');
      rotation.addTrack('user-1', { uri: 'a', title: 'A', artist: 'A', albumArt: '', addedBy: 'user-1' });
      rotation.advance();
    });

    it('should record fire votes', () => {
      rotation.voteFire('user-1');
      expect(rotation.getVotes().fire).toBe(1);
    });

    it('should not allow duplicate fire votes', () => {
      rotation.voteFire('user-1');
      const result = rotation.voteFire('user-1');
      expect(result).toBe(false);
      expect(rotation.getVotes().fire).toBe(1);
    });

    it('should not skip with minority skip votes', () => {
      const shouldSkip = rotation.voteSkip('user-1');
      expect(shouldSkip).toBe(false);
    });

    it('should skip with majority skip votes', () => {
      rotation.voteSkip('user-1');
      const shouldSkip = rotation.voteSkip('user-2');
      expect(shouldSkip).toBe(true);
    });
  });
});
