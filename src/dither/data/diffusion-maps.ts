const maps = {
  floydSteinberg: () => [
    { offset: [1, 0], factor: 7 / 16 },
    { offset: [-1, 1], factor: 3 / 16 },
    { offset: [0, 1], factor: 5 / 16 },
    { offset: [1, 1], factor: 1 / 16 },
  ],
  falseFloydSteinberg: () => [
    { offset: [1, 0], factor: 3 / 8 },
    { offset: [0, 1], factor: 3 / 8 },
    { offset: [1, 1], factor: 2 / 8 },
  ],
  atkinson: () => [
    { offset: [1, 0], factor: 1 / 8 },
    { offset: [2, 0], factor: 1 / 8 },
    { offset: [-1, 1], factor: 1 / 8 },
    { offset: [0, 1], factor: 1 / 8 },
    { offset: [1, 1], factor: 1 / 8 },
    { offset: [0, 2], factor: 1 / 8 },
  ],
  jarvis: () => [
    { offset: [1, 0], factor: 7 / 48 },
    { offset: [2, 0], factor: 5 / 48 },

    { offset: [-2, 1], factor: 3 / 48 },
    { offset: [-1, 1], factor: 5 / 48 },
    { offset: [0, 1], factor: 7 / 48 },
    { offset: [1, 1], factor: 5 / 48 },
    { offset: [2, 1], factor: 3 / 48 },

    { offset: [-2, 2], factor: 1 / 48 },
    { offset: [-1, 2], factor: 3 / 48 },
    { offset: [0, 2], factor: 4 / 48 },
    { offset: [1, 2], factor: 3 / 48 },
    { offset: [2, 2], factor: 1 / 48 },
  ],
  stucki: () => [
    { offset: [1, 0], factor: 8 / 42 },
    { offset: [2, 0], factor: 4 / 42 },

    { offset: [-2, 1], factor: 2 / 42 },
    { offset: [-1, 1], factor: 4 / 42 },
    { offset: [0, 1], factor: 8 / 42 },
    { offset: [1, 1], factor: 4 / 42 },
    { offset: [2, 1], factor: 2 / 42 },

    { offset: [-2, 2], factor: 1 / 42 },
    { offset: [-1, 2], factor: 2 / 42 },
    { offset: [0, 2], factor: 4 / 42 },
    { offset: [1, 2], factor: 2 / 42 },
    { offset: [2, 2], factor: 1 / 42 },
  ],
  burkes: () => [
    { offset: [1, 0], factor: 8 / 32 },
    { offset: [2, 0], factor: 4 / 32 },

    { offset: [-2, 1], factor: 2 / 32 },
    { offset: [-1, 1], factor: 4 / 32 },
    { offset: [0, 1], factor: 8 / 32 },
    { offset: [1, 1], factor: 4 / 32 },
    { offset: [2, 1], factor: 2 / 32 },
  ],
  sierra3: () => [
    { offset: [1, 0], factor: 5 / 32 },
    { offset: [2, 0], factor: 3 / 32 },

    { offset: [-2, 1], factor: 2 / 32 },
    { offset: [-1, 1], factor: 4 / 32 },
    { offset: [0, 1], factor: 5 / 32 },
    { offset: [1, 1], factor: 4 / 32 },
    { offset: [2, 1], factor: 2 / 32 },

    { offset: [-1, 2], factor: 2 / 32 },
    { offset: [0, 2], factor: 3 / 32 },
    { offset: [1, 2], factor: 2 / 32 },
  ],
  sierra2: () => [
    { offset: [1, 0], factor: 4 / 16 },
    { offset: [2, 0], factor: 3 / 16 },

    { offset: [-2, 1], factor: 1 / 16 },
    { offset: [-1, 1], factor: 2 / 16 },
    { offset: [0, 1], factor: 3 / 16 },
    { offset: [1, 1], factor: 2 / 16 },
    { offset: [2, 1], factor: 1 / 16 },
  ],
  "sierra2-4a": () => [
    { offset: [1, 0], factor: 2 / 4 },
    { offset: [-2, 1], factor: 1 / 4 },
    { offset: [-1, 1], factor: 1 / 4 },
  ],
  "Sierra2-4A": () => maps["sierra2-4a"](),
};

export default maps;
