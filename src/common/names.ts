import { choice } from './random';

const FIRST_NAMES: Record<string, string[]> = {
  male: [
    'Aeron', 'Zylos', 'Kael', 'Jax', 'Rian', 'Tyrus', 'Vax', 'Kyx',
    'Dax', 'Lex', 'Rex', 'Jett', 'Finn', 'Cole', 'Max', 'Leo',
    'Kai', 'Zane', 'Eli', 'Owen', 'Gabe', 'Luke', 'Noah',
    'Liam', 'Ethan', 'Lucas', 'Mason', 'Oliver', 'Elijah',
    'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander',
    'Sebastian', 'Theodore', 'Jack', 'Aiden', 'Owen', 'Samuel',
    'Ryan', 'Dylan', 'Nathan', 'Cameron', 'Isaac', 'Luke', 'Gabriel'
  ],
  female: [
    'Lyra', 'Nova', 'Vera', 'Zara', 'Kira', 'Mira', 'Nyx', 'Vex',
    'Ayla', 'Ivy', 'Maya', 'Luna', 'Aria', 'Nora', 'Ella',
    'Zoe', 'Ava', 'Mia', 'Layla', 'Harper', 'Isabella', 'Sophia',
    'Aria', 'Riley', 'Aaliyah', 'Amelia', 'Charlotte', 'Chloe',
    'Grace', 'Lily', 'Zoey', 'Eva', 'Willow', 'Hazel', 'Violet',
    'Stella', 'Penelope', 'Victoria', 'Lillian', 'Addison', 'Bella'
  ]
};

const LAST_NAMES = [
  'Chen', 'Wu', 'Liu', 'Yang', 'Zhang', 'Wang', 'Li', 'Zhao', 'Huang', 'Zhou',
  'Kim', 'Park', 'Lee', 'Choi', 'Jung', 'Kang', 'Lim', 'Han', 'Oh', 'Yoon',
  'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Yamamoto', 'Kobayashi', 'Nakamura',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
  'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz',
  'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales'
];

const NICKNAMES = [
  'Blaze', 'Ace', 'Rocket', 'Flash', 'Tank', 'Spike', 'Chief', 'Doc', 'Crusher',
  'Thunder', 'Lightning', 'Storm', 'Viper', 'Shadow', 'Ghost', 'Ice', 'Fire'
];

export function randomName(): string {
  const gender = Math.random() < 0.5 ? 'male' : 'female';
  const firstName = choice(FIRST_NAMES[gender]);
  const lastName = choice(LAST_NAMES);

  return `${firstName} ${lastName}`;
}

export function randomNameWithNickname(): string {
  const baseName = randomName();
  const nickname = choice(NICKNAMES);

  return `${baseName} "${nickname}"`;
}

export function randomFirstName(gender?: 'male' | 'female'): string {
  const selectedGender = gender || (Math.random() < 0.5 ? 'male' : 'female');
  return choice(FIRST_NAMES[selectedGender]);
}

export function randomLastName(): string {
  return choice(LAST_NAMES);
}

export function randomNickname(): string {
  return choice(NICKNAMES);
}
