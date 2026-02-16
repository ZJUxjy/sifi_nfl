import { generateAllTeams } from '../../worker/core/team/generate';

self.onmessage = (e: MessageEvent<{ season: number }>) => {
  const { season } = e.data;
  const result = generateAllTeams(season);
  self.postMessage(result);
};

export {};
