import { useEffect, useRef } from 'react';
import { Card, Spinner } from 'react-bootstrap';
import type { PlayByPlayEvent } from '@worker/core/game/PlayByPlayLogger';

interface PlayByPlayViewProps {
  events: PlayByPlayEvent[];
  teamNames: [string, string];
  isSimulating?: boolean;
}

function formatTime(clock: number): string {
  const minutes = Math.floor(clock);
  const seconds = Math.floor((clock % 1) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatQuarter(event: PlayByPlayEvent): string {
  if ('quarter' in event && typeof event.quarter === 'number') {
    const q = event.quarter;
    if (q > 4) {
      return `OT${q - 4 > 1 ? q - 4 : ''}`;
    }
    const quarterNames = ['1st', '2nd', '3rd', '4th'];
    return quarterNames[q - 1] || `${q}th`;
  }
  return '1st';
}

function formatFieldPosition(scrimmage: number, t: 0 | 1, teamNames: [string, string]): string {
  if (scrimmage <= 0) return `${teamNames[1 - t]} 0`;
  if (scrimmage >= 100) return `${teamNames[t]} 0`;
  if (scrimmage <= 50) return `${teamNames[1 - t]} ${50 - scrimmage}`;
  return `${teamNames[t]} ${scrimmage - 50}`;
}

function formatEvent(event: PlayByPlayEvent, teamNames: [string, string]): string {
  const teamName = 't' in event ? teamNames[event.t as 0 | 1] : '';
  const time = formatTime(event.clock);
  const quarter = formatQuarter(event);

  const parts: string[] = [`[${quarter} ${time}]`];

  switch (event.type) {
    case 'kickoff':
      parts.push(`${event.names?.[0] || 'Kicker'} kicks ${event.yds} yards`);
      if (event.touchback) parts.push('- Touchback');
      break;
    case 'kickoffReturn':
      parts.push(`${event.names?.[0] || 'Returner'} returns kickoff ${event.yds} yards`);
      if (event.td) parts.push('- TOUCHDOWN!');
      break;
    case 'punt':
      parts.push(`${event.names?.[0] || 'Punter'} punts ${event.yds} yards`);
      if (event.touchback) parts.push('- Touchback');
      break;
    case 'puntReturn':
      parts.push(`${event.names?.[0] || 'Returner'} returns punt ${event.yds} yards`);
      if (event.td) parts.push('- TOUCHDOWN!');
      break;
    case 'pass':
      parts.push(`${event.names?.[0] || 'QB'} pass to ${event.names?.[1] || 'Receiver'} for ${event.yds} yards`);
      if (event.td) parts.push('- TOUCHDOWN!');
      if (event.safety) parts.push('- SAFETY!');
      break;
    case 'passIncomplete':
      parts.push(`${event.names?.[0] || 'QB'} pass incomplete`);
      break;
    case 'run':
      parts.push(`${event.names?.[0] || 'Runner'} runs for ${event.yds} yards`);
      if (event.td) parts.push('- TOUCHDOWN!');
      if (event.safety) parts.push('- SAFETY!');
      break;
    case 'sack':
      parts.push(`${event.names?.[0] || 'QB'} sacked by ${event.names?.[1] || 'Defender'} for -${Math.abs(event.yds)} yards`);
      if (event.safety) parts.push('- SAFETY!');
      break;
    case 'fieldGoal':
      parts.push(`${event.names?.[0] || 'Kicker'} ${event.made ? 'makes' : 'misses'} ${event.yds} yard FG`);
      break;
    case 'extraPoint':
      parts.push(`${event.names?.[0] || 'Kicker'} ${event.made ? 'makes' : 'misses'} XP`);
      break;
    case 'kneel':
      parts.push(`${event.names?.[0] || 'QB'} kneels for -${Math.abs(event.yds)} yards`);
      break;
    case 'turnoverOnDowns':
      parts.push(`Turnover on downs - ${teamName} takes over`);
      break;
    case 'quarter':
      parts.push(`--- End of ${event.quarter}${getOrdinal(event.quarter)} Quarter ---`);
      break;
    case 'overtime':
      parts.push(`--- Overtime ${event.overtimeNum} Begins ---`);
      break;
    case 'gameOver':
      parts.push('=== GAME OVER ===');
      break;
    case 'penalty':
      parts.push(`Penalty on ${teamName}: ${event.penaltyName} (${event.yds} yards)`);
      break;
    case 'timeout':
      parts.push(`${teamName} calls timeout`);
      break;
    case 'twoMinuteWarning':
      parts.push('*** Two Minute Warning ***');
      break;
    default:
      parts.push(`${event.type}`);
  }

  if (event.down && event.toGo && event.scrimmage !== undefined && 't' in event) {
    const fieldPos = formatFieldPosition(event.scrimmage, event.t as 0 | 1, teamNames);
    parts.push(`(${event.down}${getOrdinal(event.down)} & ${event.toGo} at ${fieldPos})`);
  }

  return parts.join(' ');
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function getEventClassName(event: PlayByPlayEvent): string {
  switch (event.type) {
    case 'pass':
    case 'run':
    case 'kickoffReturn':
    case 'puntReturn':
      if ('td' in event && event.td) return 'pbp-event td';
      break;
    case 'fieldGoal':
      if (event.made) return 'pbp-event fg-good';
      break;
    case 'extraPoint':
      if (event.made) return 'pbp-event xp-good';
      break;
    case 'sack':
    case 'passIncomplete':
    case 'turnoverOnDowns':
      return 'pbp-event negative';
    case 'penalty':
      return 'pbp-event penalty';
    case 'quarter':
    case 'overtime':
    case 'gameOver':
      return 'pbp-event quarter-break';
    default:
      return 'pbp-event';
  }
  return 'pbp-event';
}

function PlayByPlayView({ events, teamNames, isSimulating }: PlayByPlayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <Card className="play-by-play-view">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <strong>Play by Play</strong>
        {isSimulating && (
          <Spinner animation="border" size="sm" variant="primary" />
        )}
      </Card.Header>
      <Card.Body ref={scrollRef} className="pbp-events">
        {events.length === 0 ? (
          <p className="text-muted text-center my-4">Game events will appear here...</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {events.map((event, index) => (
              <li key={index} className={getEventClassName(event)}>
                {formatEvent(event, teamNames)}
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

export default PlayByPlayView;
