## ADDED Requirements

### Requirement: Side-by-side layout
The system SHALL render the main workspace in a left-right split layout, with the operation panel on the left and the game preview panel on the right, both visible within the same viewport without requiring vertical scrolling.

#### Scenario: Desktop view renders left-right split
- **WHEN** the user opens the Game Weaver application on a viewport at least 1024px wide
- **THEN** the main content area below the header is split into two columns: a left panel for operations and a right panel for game preview
- **AND** both panels are visible simultaneously without scrolling

#### Scenario: Left panel scrolls independently
- **WHEN** the content in the left operation panel exceeds the viewport height
- **THEN** the left panel can scroll vertically independently
- **AND** the right preview panel remains fixed in place

#### Scenario: Right panel height fills viewport
- **WHEN** the user views the game preview panel
- **THEN** the preview panel height equals the viewport height minus the header bar height
- **AND** the preview panel does not scroll with the left panel

### Requirement: Responsive fallback
The system SHALL fall back to a vertically stacked layout on narrow viewports where the side-by-side layout would be unusable.

#### Scenario: Narrow viewport stacks vertically
- **WHEN** the user opens the application on a viewport narrower than 1024px
- **THEN** the layout reverts to vertical stacking (operations above, preview below)
- **AND** both sections have reasonable minimum heights

### Requirement: Left panel content organization
The system SHALL organize all operation controls within the left panel, including creative input, plan editing, generation buttons, and tweak controls.

#### Scenario: Creative input section at top of left panel
- **WHEN** the user views the left operation panel
- **THEN** the creative input textarea and generation buttons appear at the top of the left panel
- **AND** the "生成策划" and "生成游戏" buttons are prominently visible

#### Scenario: Plan cards and editor in middle of left panel
- **WHEN** the user scrolls down in the left panel past the creative input section
- **THEN** the six plan section cards are displayed in a compact grid
- **AND** selecting a card reveals its editor textarea immediately below the grid

#### Scenario: Tweak controls at bottom of left panel
- **WHEN** the user has generated a game and scrolls to the bottom of the left panel
- **THEN** the tweak input and "微调游戏" button are visible
- **AND** the "保存游戏" button is also accessible

### Requirement: Game preview panel
The system SHALL display the generated game preview in the right panel at all times when a preview is available.

#### Scenario: Preview visible during editing
- **WHEN** the user edits plan content in the left panel
- **THEN** the game preview in the right panel remains visible and unchanged
- **AND** the preview does not reload or flicker during editing

#### Scenario: Waiting mini-game renders in right panel
- **WHEN** a game is being generated and the mini-game hub is active
- **THEN** the mini-game canvas and stage progress indicators render within the right panel
- **AND** the mini-game is fully playable at its designed dimensions

#### Scenario: Empty preview state
- **WHEN** no game has been generated yet
- **THEN** the right panel displays a placeholder with the text "生成后这里显示可玩预览" and a gamepad icon
- **AND** the placeholder is centered vertically and horizontally within the panel

### Requirement: Light theme compatibility
The system SHALL maintain full compliance with the existing light-theme specification in the new layout.

#### Scenario: Light backgrounds in all panels
- **WHEN** the user views any part of the new layout
- **THEN** all panel backgrounds use white or light gray per the light-theme spec
- **AND** text colors remain dark for readability
- **AND** borders use light neutral tones

### Requirement: Refined aesthetic — no generic AI look
The system SHALL present a polished, professional visual design that avoids the generic aesthetic commonly associated with AI-generated interfaces.

#### Scenario: Typography is intentional
- **WHEN** the user views any text in the application
- **THEN** font sizes follow a clear hierarchy with deliberate contrast between headings and body text
- **AND** font weight transitions are subtle and purposeful
- **AND** letter-spacing and line-height are tuned for readability, not mechanical defaults

#### Scenario: No default AI aesthetic patterns
- **WHEN** the user views the interface
- **THEN** the design does NOT use large rounded purple/violet gradient cards, bouncing dot animations, or sparkle emoji decorations
- **AND** the design does NOT use monospace or typewriter-style placeholder text in input fields
- **AND** the design does NOT rely on emoji as primary visual language

#### Scenario: Subtle and refined visual details
- **WHEN** the user interacts with the interface
- **THEN** shadows are subtle (barely perceptible elevation, not heavy drop shadows)
- **AND** border colors use refined gray tones that feel intentional, not default browser grays
- **AND** hover and focus states transition smoothly with subtle color shifts
- **AND** border-radius values are consistent and restrained (not overly rounded)

#### Scenario: Professional tool atmosphere
- **WHEN** the user opens Game Weaver
- **THEN** the interface conveys a sense of a professional creative tool, not a demo or toy
- **AND** empty states are dignified and minimal rather than whimsical
- **AND** loading states are understated and informative
- **AND** the overall composition feels balanced and calm, not cluttered or noisy
