## ADDED Requirements

### Requirement: Global light background
The system SHALL use a white or light gray background across all sections instead of dark colors.

#### Scenario: Main page renders with white background
- **WHEN** the user opens the Game Weaver application
- **THEN** the main background is white (`#ffffff`) or near-white (`bg-zinc-50`)
- **AND** the header and section backgrounds use light neutral tones (`bg-white`, `bg-zinc-50`, `bg-zinc-100`)

#### Scenario: No dark mode is applied
- **WHEN** the user's operating system is set to dark mode
- **THEN** the application still displays in light theme

### Requirement: Dark text on light background
The system SHALL use dark text colors to ensure readability against light backgrounds.

#### Scenario: Headings and body text are readable
- **WHEN** the user views any section of the application
- **THEN** headings and body text render in dark shades (`text-zinc-800`, `text-zinc-900`) on light backgrounds
- **AND** secondary text uses medium contrast (`text-zinc-500`, `text-zinc-600`)

#### Scenario: Input fields have sufficient contrast
- **WHEN** the user focuses on a text input or textarea
- **THEN** the input background is white or very light gray
- **AND** the input text is dark (`text-zinc-900`)
- **AND** the placeholder text has at least 4.5:1 contrast ratio against the background

### Requirement: Light border colors
The system SHALL use light neutral border colors instead of dark borders.

#### Scenario: Sections and cards have visible boundaries
- **WHEN** the user views the page layout
- **THEN** borders and dividers between sections use light gray (`border-zinc-200`, `border-zinc-300`)
- **AND** hover states deepen the border slightly (`hover:border-zinc-300`, `hover:border-zinc-400`)

### Requirement: Brand-colored interactive elements
The system SHALL retain brand colors for primary actions while ensuring they remain visible on light backgrounds.

#### Scenario: Primary action buttons are distinctive
- **WHEN** the user views action buttons (Generate Plan, Generate Game, Tweak Game)
- **THEN** the "生成策划" button uses indigo (`bg-indigo-500` with white text)
- **AND** the "生成游戏" button uses emerald (`bg-emerald-500` with dark text)
- **AND** the "微调游戏" button uses amber (`bg-amber-500` with dark text)

#### Scenario: Disabled buttons have reduced opacity
- **WHEN** a button is in a disabled state
- **THEN** it renders with reduced opacity and cursor-not-allowed styling
- **AND** the color is still distinguishable from the background

### Requirement: Canvas mini-game light theme
The system SHALL render waiting mini-games with a light background in the canvas element.

#### Scenario: Mini-game canvas has light background
- **WHEN** the user is viewing a waiting mini-game (runner, memory, link, defense)
- **THEN** the canvas background is light (`#f8fafc` or similar)
- **AND** game text and UI elements are rendered in dark colors

### Requirement: Error and status indicators
The system SHALL use semantic colors that are visible on light backgrounds.

#### Scenario: Error messages are noticeable
- **WHEN** an error occurs during generation
- **THEN** the error message renders with a red border and light red background
- **AND** the error text is dark red and readable

#### Scenario: Status badges and chips are visible
- **WHEN** the user views status indicators (e.g., "可生成", "已恢复进度")
- **THEN** the badges render with sufficient contrast against the light background
