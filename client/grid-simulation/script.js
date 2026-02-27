        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM loaded, initializing...');
            const canvas = document.getElementById('simulationCanvas');
            const ctx = canvas.getContext('2d');
            const contextMenu = document.getElementById('contextMenu');
            const controlPanel = document.getElementById('controlPanel');
            const togglePanelBtn = document.getElementById('togglePanelBtn');
            const zoomInBtn = document.getElementById('zoomInBtn');
            const zoomOutBtn = document.getElementById('zoomOutBtn');
            const zoomLabel = document.getElementById('zoomLabel');
            const canvasContainer = document.querySelector('.canvas-container');

            // Initial state
            let state = {
                defaultUnitWidth: 70,
                defaultUnitHeight: 70,
                zoom: 1,
                plane1: {
                    visible: true,
                    offsetX: 0,
                    offsetY: 0,
                    isDragging: false,
                    zIndex: 1,
                    rows: 5,
                    cols: 5,
                    moveMode: 'x-n',
                    sequenceIndex: 0,
                    groupIndex: 0,
                    groups: [
                        {
                            startX: 0,
                            startY: 0,
                            spacingX: 400,
                            spacingY: 400,
                            color: 'rgba(255, 0, 0, 0.7)',
                            visible: true,
                            units: Array(5).fill().map((_, row) =>
                                Array(5).fill().map((_, col) => ({
                                    id: `plane1-group1-${row}-${col}`,
                                    visible: row === 0 && col === 0
                                }))
                            )
                        },
                        {
                            startX: 80,
                            startY: 0,
                            spacingX: 400,
                            spacingY: 400,
                            color: 'rgba(0, 0, 255, 0.7)',
                            visible: true,
                            units: Array(5).fill().map((_, row) =>
                                Array(5).fill().map((_, col) => ({
                                    id: `plane1-group2-${row}-${col}`,
                                    visible: false
                                }))
                            )
                        },
                        {
                            startX: 160,
                            startY: 0,
                            spacingX: 400,
                            spacingY: 400,
                            color: 'rgba(0, 128, 0, 0.7)',
                            visible: true,
                            units: Array(5).fill().map((_, row) =>
                                Array(5).fill().map((_, col) => ({
                                    id: `plane1-group3-${row}-${col}`,
                                    visible: false
                                }))
                            )
                        }
                    ]
                },
    plane2: {
        visible: true,
        startX: 0,
        startY: 0,
        spacingX: 200,
        spacingY: 200,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        color: 'rgba(0, 128, 0, 0.7)',
        zIndex: 0,
        bigRows: 2,
        bigCols: 2,
        rows: 5,
        cols: 5,
        bigMoveMode: 'x-n', // New: Movement mode for big grid
        smallMoveMode: 'x-n', // Renamed: Movement mode for small grid
        sequenceIndex: 0,
        resetAfterGroup: false,
        units: Array(2).fill().map((_, bigRow) =>
            Array(2).fill().map((_, bigCol) =>
                Array(5).fill().map((_, row) =>
                    Array(5).fill().map((_, col) => ({
                        id: `plane2-${bigRow}-${bigCol}-${row}-${col}`,
                        visible: !(bigRow === 0 && bigCol === 0 && row === 0 && col === 0),
                        color: 'rgba(128, 128, 128, 0.7)'
                    }))
                )
            )
        )
    },
    activePlane: null,
    highlightedPlane: null,
    dragStartX: 0,
    dragStartY: 0
};

// Generate movement sequence for Plane 2 (big and small grids)
// Generate movement sequence for Plane 2 (big and small grids with separate modes)
function generateSequence(bigRows, bigCols, rows, cols, bigMode, smallMode) {
    console.log(`Generating sequence for ${bigRows}x${bigCols}x${rows}x${cols}, bigMode: ${bigMode}, smallMode: ${smallMode}`);
    const sequence = [];

    // Helper to generate small grid sequence for a given big cell
    function generateSmallSequence(bigRow, bigCol) {
        const smallSequence = [];
        if (smallMode === 'x-n') {
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    smallSequence.push({ bigRow, bigCol, row, col });
                }
            }
        } else if (smallMode === 'x-s') {
            for (let row = 0; row < rows; row++) {
                if (row % 2 === 0) {
                    for (let col = 0; col < cols; col++) {
                        smallSequence.push({ bigRow, bigCol, row, col });
                    }
                } else {
                    for (let col = cols - 1; col >= 0; col--) {
                        smallSequence.push({ bigRow, bigCol, row, col });
                    }
                }
            }
        } else if (smallMode === 'y-n') {
            for (let col = 0; col < cols; col++) {
                for (let row = 0; row < rows; row++) {
                    smallSequence.push({ bigRow, bigCol, row, col });
                }
            }
        } else if (smallMode === 'y-s') {
            for (let col = 0; col < cols; col++) {
                if (col % 2 === 0) {
                    for (let row = 0; row < rows; row++) {
                        smallSequence.push({ bigRow, bigCol, row, col });
                    }
                } else {
                    for (let row = rows - 1; row >= 0; row--) {
                        smallSequence.push({ bigRow, bigCol, row, col });
                    }
                }
            }
        }
        return smallSequence;
    }

    // Generate big grid sequence
    const bigSequence = [];
    if (bigMode === 'x-n') {
        for (let bigRow = 0; bigRow < bigRows; bigRow++) {
            for (let bigCol = 0; bigCol < bigCols; bigCol++) {
                bigSequence.push({ bigRow, bigCol });
            }
        }
    } else if (bigMode === 'x-s') {
        for (let bigRow = 0; bigRow < bigRows; bigRow++) {
            if (bigRow % 2 === 0) {
                for (let bigCol = 0; bigCol < bigCols; bigCol++) {
                    bigSequence.push({ bigRow, bigCol });
                }
            } else {
                for (let bigCol = bigCols - 1; bigCol >= 0; bigCol--) {
                    bigSequence.push({ bigRow, bigCol });
                }
            }
        }
    } else if (bigMode === 'y-n') {
        for (let bigCol = 0; bigCol < bigCols; bigCol++) {
            for (let bigRow = 0; bigRow < bigRows; bigRow++) {
                bigSequence.push({ bigRow, bigCol });
            }
        }
    } else if (bigMode === 'y-s') {
        for (let bigCol = 0; bigCol < bigCols; bigCol++) {
            if (bigCol % 2 === 0) {
                for (let bigRow = 0; bigRow < bigRows; bigRow++) {
                    bigSequence.push({ bigRow, bigCol });
                }
            } else {
                for (let bigRow = bigRows - 1; bigRow >= 0; bigRow--) {
                    bigSequence.push({ bigRow, bigCol });
                }
            }
        }
    }

    // Combine big and small sequences
    bigSequence.forEach(({ bigRow, bigCol }) => {
        sequence.push(...generateSmallSequence(bigRow, bigCol));
    });

    return sequence;
}            
			
			// Complete current group
function completeCurrentGroup() {
    console.log(`Completing current group: ${state.plane1.groupIndex + 1}`);
    
    // Generate sequences
    const plane1Sequence = generateSequence(1, 1, state.plane1.rows, state.plane1.cols, state.plane1.moveMode, state.plane1.moveMode);
    const plane2Sequence = generateSequence(state.plane2.bigRows, state.plane2.bigCols, state.plane2.rows, state.plane2.cols, state.plane2.bigMoveMode, state.plane2.smallMoveMode);

    // Validate sequences
    if (plane1Sequence.length === 0 || plane2Sequence.length === 0) {
        console.error('Empty sequence generated', { plane1Sequence, plane2Sequence });
        return;
    }

    // Complete the current group by setting all units to visible
    const activeGroup = state.plane1.groups[state.plane1.groupIndex];
    activeGroup.units.forEach(row => row.forEach(unit => unit.visible = true));

    // Track group cycling
    const prevGroupIndex = state.plane1.groupIndex;
    const isThirdToFirst = prevGroupIndex === 2;
    state.plane1.groupIndex = (state.plane1.groupIndex + 1) % 3;
    state.plane1.sequenceIndex = 0;
    console.log(`Switching to group ${state.plane1.groupIndex + 1}`);

    // If cycling from third to first, hide all Plane 1 units
    if (isThirdToFirst) {
        state.plane1.groups.forEach(group => {
            group.units.forEach(row => row.forEach(unit => unit.visible = false));
        });
        console.log('Cycling from third group to first, hiding all Plane 1 units');
    }

    // Handle Plane 2 sequence and visibility
    if (state.plane2.resetAfterGroup) {
        state.plane2.sequenceIndex = 0;
        state.plane2.units.forEach(bigRow => bigRow.forEach(bigCol => bigCol.forEach(row => row.forEach(unit => {
            unit.visible = true;
            unit.color = 'rgba(128, 128, 128, 0.7)'; // Reset to gray
        }))));
        console.log('Plane 2 sequence reset and all units set visible');
    } else {
        state.plane2.sequenceIndex = (state.plane2.sequenceIndex + 1) % plane2Sequence.length;
    }

    // Get target unit positions for the new group
    const newActiveGroup = state.plane1.groups[state.plane1.groupIndex];
    const plane1Target = plane1Sequence[state.plane1.sequenceIndex] || { row: 0, col: 0 };
    const plane2Target = plane2Sequence[state.plane2.sequenceIndex] || { bigRow: 0, bigCol: 0, row: 0, col: 0 };

    // Calculate target unit positions
    const plane1TargetX = newActiveGroup.startX + plane1Target.col * newActiveGroup.spacingX;
    const plane1TargetY = newActiveGroup.startY + plane1Target.row * newActiveGroup.spacingY;
    const plane2TargetX = state.plane2.startX + (plane2Target.bigCol * state.plane2.cols + plane2Target.col) * state.plane2.spacingX;
    const plane2TargetY = state.plane2.startY + (plane2Target.bigRow * state.plane2.rows + plane2Target.row) * state.plane2.spacingY;

    // Calculate canvas center (adjusted for zoom)
    const canvasCenterX = canvas.width / (2 * state.zoom);
    const canvasCenterY = canvas.height / (2 * state.zoom);

    // Center the target units
    state.plane1.offsetX = canvasCenterX - plane1TargetX - state.defaultUnitWidth / 2;
    state.plane1.offsetY = canvasCenterY - plane1TargetY - state.defaultUnitHeight / 2;
    state.plane2.offsetX = plane1TargetX - plane2TargetX + state.plane1.offsetX;
    state.plane2.offsetY = plane1TargetY - plane2TargetY + state.plane1.offsetY;

    // Set visibility for Plane 1: Make the first unit of the new group visible
    newActiveGroup.units[plane1Target.row][plane1Target.col].visible = true;

    // Reset Plane 2 colors to gray for all visible units
    state.plane2.units.forEach(bigRow => bigRow.forEach(bigCol => bigCol.forEach(row => row.forEach(unit => {
        if (unit.visible) {
            unit.color = 'rgba(128, 128, 128, 0.7)'; // Gray
        }
    }))));

    // Detect overlaps and set Plane 2 overlapped units to black
    const plane1TargetWorldX = state.plane1.offsetX + plane1TargetX;
    const plane1TargetWorldY = state.plane1.offsetY + plane1TargetY;
    for (let bigRow = 0; bigRow < state.plane2.bigRows; bigRow++) {
        for (let bigCol = 0; bigCol < state.plane2.bigCols; bigCol++) {
            for (let row = 0; row < state.plane2.rows; row++) {
                for (let col = 0; col < state.plane2.cols; col++) {
                    const unit = state.plane2.units[bigRow][bigCol][row][col];
                    if (unit.visible) {
                        const plane2UnitX = state.plane2.offsetX + state.plane2.startX + (bigCol * state.plane2.cols + col) * state.plane2.spacingX;
                        const plane2UnitY = state.plane2.offsetY + state.plane2.startY + (bigRow * state.plane2.rows + row) * state.plane2.spacingY;
                        if (
                            Math.abs(plane1TargetWorldX - plane2UnitX) < state.defaultUnitWidth / 2 &&
                            Math.abs(plane1TargetWorldY - plane2UnitY) < state.defaultUnitHeight / 2
                        ) {
                            unit.color = 'rgba(0, 0, 0, 0.7)'; // Black for overlapped unit
                        }
                    }
                }
            }
        }
    }

    // Set visibility for Plane 2: Hide the new target unit
    if (state.plane2.units[plane2Target.bigRow]?.[plane2Target.bigCol]?.[plane2Target.row]?.[plane2Target.col]) {
        state.plane2.units[plane2Target.bigRow][plane2Target.bigCol][plane2Target.row][plane2Target.col].visible = false;
    }

    // Check if all Plane 2 units are hidden
    if (areAllPlane2UnitsHidden()) {
        console.log('All Plane 2 units hidden, resetting visibility');
        state.plane2.units.forEach(bigRow => bigRow.forEach(bigCol => bigCol.forEach(row => row.forEach(unit => {
            unit.visible = true;
            unit.color = 'rgba(128, 128, 128, 0.7)'; // Gray
        }))));
        state.plane2.sequenceIndex = 0;
        const newPlane2Target = plane2Sequence[0] || { bigRow: 0, bigCol: 0, row: 0, col: 0 };
        state.plane2.offsetX = plane1TargetX - (state.plane2.startX + (newPlane2Target.bigCol * state.plane2.cols + newPlane2Target.col) * state.plane2.spacingX) + state.plane1.offsetX;
        state.plane2.offsetY = plane1TargetY - (state.plane2.startY + (newPlane2Target.bigRow * state.plane2.rows + newPlane2Target.row) * state.plane2.spacingY) + state.plane1.offsetY;
        if (state.plane2.units[newPlane2Target.bigRow]?.[newPlane2Target.bigCol]?.[newPlane2Target.row]?.[newPlane2Target.col]) {
            state.plane2.units[newPlane2Target.bigRow][newPlane2Target.bigCol][newPlane2Target.row][newPlane2Target.col].visible = false;
        }
    }

    updateCanvas();
}
            // Reset planes to align top-left units
            function resetOverlap() {
                console.log('Resetting overlap');
                // Calculate canvas center (adjusted for zoom)
                const canvasCenterX = canvas.width / (2 * state.zoom);
                const canvasCenterY = canvas.height / (2 * state.zoom);

                // Plane 1: Center the top-left unit of the first group
                const firstGroup = state.plane1.groups[0];
                const plane1TargetX = firstGroup.startX;
                const plane1TargetY = firstGroup.startY;
                state.plane1.offsetX = canvasCenterX - plane1TargetX - state.defaultUnitWidth / 2;
                state.plane1.offsetY = canvasCenterY - plane1TargetY - state.defaultUnitHeight / 2;

                // Plane 2: Align top-left unit with Plane 1's top-left unit
                state.plane2.offsetX = plane1TargetX - state.plane2.startX + state.plane1.offsetX;
                state.plane2.offsetY = plane1TargetY - state.plane2.startY + state.plane1.offsetY;

                // Reset visibility and colors
                state.plane1.groups.forEach(group => {
                    group.units.forEach(row => row.forEach(unit => unit.visible = false));
                });
                state.plane2.units.forEach(bigRow => bigRow.forEach(bigCol => bigCol.forEach(row => row.forEach(unit => {
                    unit.visible = true;
                    unit.color = 'rgba(128, 128, 128, 0.7)'; // Gray
                }))));

                // Set top-left unit visibility
                state.plane1.groups[0].units[0][0].visible = true;
                state.plane2.units[0][0][0][0].visible = false;

                // Reset indices
                state.plane1.groupIndex = 0;
                state.plane1.sequenceIndex = 0;
                state.plane2.sequenceIndex = 0;

                updateCanvas();
            }

            // Check if all Plane 2 units are hidden
            function areAllPlane2UnitsHidden() {
                return state.plane2.units.every(bigRow => bigRow.every(bigCol => bigCol.every(row => row.every(unit => !unit.visible))));
            }

            // Move planes to next unit in sequence
            function stepMove() {
                console.log(`Step move triggered, active group: ${state.plane1.groupIndex + 1}`);
const plane1Sequence = generateSequence(1, 1, state.plane1.rows, state.plane1.cols, state.plane1.moveMode, state.plane1.moveMode);
const plane2Sequence = generateSequence(state.plane2.bigRows, state.plane2.bigCols, state.plane2.rows, state.plane2.cols, state.plane2.bigMoveMode, state.plane2.smallMoveMode);

                // Track if Plane 1 group is switching
                let isGroupSwitch = false;
                let isThirdToFirst = false;

                // Increment sequence indices
                state.plane1.sequenceIndex = state.plane1.sequenceIndex + 1;
                if (state.plane1.sequenceIndex >= plane1Sequence.length) {
                    // Current group completed, cycle to next group
                    state.plane1.sequenceIndex = 0;
                    const prevGroupIndex = state.plane1.groupIndex;
                    state.plane1.groupIndex = (state.plane1.groupIndex + 1) % 3;
                    isGroupSwitch = true;
                    if (prevGroupIndex === 2 && state.plane1.groupIndex === 0) {
                        isThirdToFirst = true;
                        console.log('Cycling from third group to first, hiding all Plane 1 units');
                    }
                    console.log(`Switching to group ${state.plane1.groupIndex + 1}`);
                }

                // Handle Plane 2 sequence index and visibility
                if (isGroupSwitch && state.plane2.resetAfterGroup) {
                    state.plane2.sequenceIndex = 0; // Reset to start
                    state.plane2.units.forEach(bigRow => bigRow.forEach(bigCol => bigCol.forEach(row => row.forEach(unit => {
                        unit.visible = true;
                        unit.color = 'rgba(128, 128, 128, 0.7)'; // Reset to gray
                    }))));
                    console.log('Plane 2 sequence reset and all units set visible due to group completion and toggle enabled');
                } else {
                    state.plane2.sequenceIndex = (state.plane2.sequenceIndex + 1) % plane2Sequence.length;
                }

                // Get target unit positions
                const activeGroup = state.plane1.groups[state.plane1.groupIndex];
                const plane1Target = plane1Sequence[state.plane1.sequenceIndex % plane1Sequence.length];
                const plane2Target = plane2Sequence[state.plane2.sequenceIndex];

                // Calculate target unit positions (relative to their plane's offset)
                const plane1TargetX = activeGroup.startX + plane1Target.col * activeGroup.spacingX;
                const plane1TargetY = activeGroup.startY + plane1Target.row * activeGroup.spacingY;
                const plane2TargetX = state.plane2.startX + (plane2Target.bigCol * state.plane2.cols + plane2Target.col) * state.plane2.spacingX;
                const plane2TargetY = state.plane2.startY + (plane2Target.bigRow * state.plane2.rows + plane2Target.row) * state.plane2.spacingY;

                // Calculate canvas center (adjusted for zoom)
                const canvasCenterX = canvas.width / (2 * state.zoom);
                const canvasCenterY = canvas.height / (2 * state.zoom);

                // Center the target units by adjusting plane offsets
                state.plane1.offsetX = canvasCenterX - plane1TargetX - state.defaultUnitWidth / 2;
                state.plane1.offsetY = canvasCenterY - plane1TargetY - state.defaultUnitHeight / 2;
                state.plane2.offsetX = plane1TargetX - plane2TargetX + state.plane1.offsetX;
                state.plane2.offsetY = plane1TargetY - plane2TargetY + state.plane1.offsetY;

                // Set visibility for Plane 1
                if (isThirdToFirst) {
                    // Hide all Plane 1 units when cycling from third to first group
                    state.plane1.groups.forEach(group => {
                        group.units.forEach(row => row.forEach(unit => unit.visible = false));
                    });
                }
                // Make the current target unit visible
                activeGroup.units[plane1Target.row][plane1Target.col].visible = true;

                // Reset Plane 2 colors to gray for all visible units
                state.plane2.units.forEach(bigRow => bigRow.forEach(bigCol => bigCol.forEach(row => row.forEach(unit => {
                    if (unit.visible) {
                        unit.color = 'rgba(128, 128, 128, 0.7)'; // Gray
                    }
                }))));

                // Detect overlaps and set Plane 2 overlapped units to black
                const plane1TargetWorldX = state.plane1.offsetX + plane1TargetX;
                const plane1TargetWorldY = state.plane1.offsetY + plane1TargetY;
                for (let bigRow = 0; bigRow < state.plane2.bigRows; bigRow++) {
                    for (let bigCol = 0; bigCol < state.plane2.bigCols; bigCol++) {
                        for (let row = 0; row < state.plane2.rows; row++) {
                            for (let col = 0; col < state.plane2.cols; col++) {
                                const unit = state.plane2.units[bigRow][bigCol][row][col];
                                if (unit.visible) {
                                    const plane2UnitX = state.plane2.offsetX + state.plane2.startX + (bigCol * state.plane2.cols + col) * state.plane2.spacingX;
                                    const plane2UnitY = state.plane2.offsetY + state.plane2.startY + (bigRow * state.plane2.rows + row) * state.plane2.spacingY;
                                    if (
                                        Math.abs(plane1TargetWorldX - plane2UnitX) < state.defaultUnitWidth &&
                                        Math.abs(plane1TargetWorldY - plane2UnitY) < state.defaultUnitHeight
                                    ) {
                                        unit.color = 'rgba(0, 0, 0, 0.7)'; // Black for overlapped unit
                                    }
                                }
                            }
                        }
                    }
                }

                // Set visibility for Plane 2: Hide previous target unit, hide new target unit
                if (state.plane2.sequenceIndex > 0 || areAllPlane2UnitsHidden()) {
                    const prevPlane2Index = (state.plane2.sequenceIndex - 1 + plane2Sequence.length) % plane2Sequence.length;
                    const prevPlane2Target = plane2Sequence[prevPlane2Index];
                    state.plane2.units[prevPlane2Target.bigRow][prevPlane2Target.bigCol][prevPlane2Target.row][prevPlane2Target.col].visible = false;
                }

                // Check if Plane 2 units are all hidden
                if (areAllPlane2UnitsHidden()) {
                    console.log('All Plane 2 units hidden, resetting visibility');
                    state.plane2.units.forEach(bigRow => bigRow.forEach(bigCol => bigCol.forEach(row => row.forEach(unit => {
                        unit.visible = true;
                        unit.color = 'rgba(128, 128, 128, 0.7)'; // Gray
                    }))));
                    state.plane2.sequenceIndex = 0;
                    const newPlane2Target = plane2Sequence[state.plane2.sequenceIndex];
                    state.plane2.offsetX = plane1TargetX - (state.plane2.startX + (newPlane2Target.bigCol * state.plane2.cols + newPlane2Target.col) * state.plane2.spacingX) + state.plane1.offsetX;
                    state.plane2.offsetY = plane1TargetY - (state.plane2.startY + (newPlane2Target.bigRow * state.plane2.rows + newPlane2Target.row) * state.plane2.spacingY) + state.plane1.offsetY;
                    state.plane2.units[newPlane2Target.bigRow][newPlane2Target.bigCol][newPlane2Target.row][newPlane2Target.col].visible = false;
                } else {
                    state.plane2.units[plane2Target.bigRow][plane2Target.bigCol][plane2Target.row][plane2Target.col].visible = false;
                }

                updateCanvas();
            }

            // Resize canvas
            function resizeCanvas() {
                console.log('Resizing canvas');
                canvas.width = canvasContainer.clientWidth;
                canvas.height = canvasContainer.clientHeight;
                updateCanvas();
            }

            // Update canvas
            function updateCanvas() {
                console.log('Updating canvas');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                ctx.scale(state.zoom, state.zoom);

                const planes = [
                    { id: 'plane1', data: state.plane1 },
                    { id: 'plane2', data: state.plane2 }
                ].sort((a, b) => a.data.zIndex - b.data.zIndex);

                planes.forEach(plane => {
                    const planeData = plane.data;

                    // Calculate bounding box
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                    if (plane.id === 'plane2') {
                        for (let bigRow = 0; bigRow < planeData.bigRows; bigRow++) {
                            for (let bigCol = 0; bigCol < planeData.bigCols; bigCol++) {
                                for (let row = 0; row < planeData.rows; row++) {
                                    for (let col = 0; col < planeData.cols; col++) {
                                        const x = planeData.offsetX + planeData.startX + (bigCol * planeData.cols + col) * planeData.spacingX;
                                        const y = planeData.offsetY + planeData.startY + (bigRow * planeData.rows + row) * planeData.spacingY;
                                        minX = Math.min(minX, x);
                                        minY = Math.min(minY, y);
                                        maxX = Math.max(maxX, x + state.defaultUnitWidth);
                                        maxY = Math.max(maxY, y + state.defaultUnitHeight);
                                    }
                                }
                            }
                        }
                    } else if (plane.id === 'plane1') {
                        planeData.groups.forEach(group => {
                            for (let row = 0; row < planeData.rows; row++) {
                                for (let col = 0; col < planeData.cols; col++) {
                                    const x = planeData.offsetX + group.startX + col * group.spacingX;
                                    const y = planeData.offsetY + group.startY + row * group.spacingY;
                                    minX = Math.min(minX, x);
                                    minY = Math.min(minY, y);
                                    maxX = Math.max(maxX, x + state.defaultUnitWidth);
                                    maxY = Math.max(maxY, y + state.defaultUnitHeight);
                                }
                            }
                        });
                    }

                    const padding = 10;
                    minX -= padding;
                    minY -= padding;
                    maxX += padding;
                    maxY += padding;

                    const width = maxX - minX;
                    const height = maxY - minY;

                    // Draw plane border
                    ctx.strokeStyle = plane.id === 'plane1' ? 'blue' : 'green';
                    ctx.lineWidth = 2 / state.zoom;
                    if (!planeData.visible) {
                        ctx.setLineDash([5, 5]);
                    }
                    if (state.highlightedPlane === plane.id) {
                        ctx.strokeStyle = 'yellow';
                        ctx.lineWidth = 4 / state.zoom;
                    }
                    ctx.strokeRect(minX, minY, width, height);
                    ctx.setLineDash([]);
                    ctx.strokeStyle = plane.id === 'plane1' ? 'blue' : 'green';
                    ctx.lineWidth = 2 / state.zoom;

                    // Draw units
                    if (plane.id === 'plane2') {
    // Draw big grid boundaries
    for (let bigRow = 0; bigRow < planeData.bigRows; bigRow++) {
        for (let bigCol = 0; bigCol < planeData.bigCols; bigCol++) {
            const bigX = planeData.offsetX + planeData.startX + bigCol * planeData.cols * planeData.spacingX;
            const bigY = planeData.offsetY + planeData.startY + bigRow * planeData.rows * planeData.spacingY;
            const bigWidth = planeData.cols * planeData.spacingX;
            const bigHeight = planeData.rows * planeData.spacingY;
            ctx.strokeStyle = planeData.visible ? 'rgba(0, 128, 0, 0.5)' : 'rgba(0, 128, 0, 0.3)';
            ctx.lineWidth = 3 / state.zoom;
            if (!planeData.visible) {
                ctx.setLineDash([5, 5]);
            }
            ctx.strokeRect(bigX, bigY, bigWidth, bigHeight);
            ctx.setLineDash([]);
        }
    }
    // Draw units
    for (let bigRow = 0; bigRow < planeData.bigRows; bigRow++) {
        for (let bigCol = 0; bigCol < planeData.bigCols; bigCol++) {
            for (let row = 0; row < planeData.rows; row++) {
                for (let col = 0; col < planeData.cols; col++) {
                    const unit = planeData.units[bigRow][bigCol][row][col];
                    const x = planeData.offsetX + planeData.startX + (bigCol * planeData.cols + col) * planeData.spacingX;
                    const y = planeData.offsetY + planeData.startY + (bigRow * planeData.rows + row) * planeData.spacingY;
                    if (planeData.visible && unit.visible) {
                        ctx.fillStyle = unit.color;
                        ctx.fillRect(x, y, state.defaultUnitWidth, state.defaultUnitHeight);
                    } else {
                        ctx.strokeStyle = unit.color;
                        ctx.setLineDash([5, 5]);
                        ctx.strokeRect(x, y, state.defaultUnitWidth, state.defaultUnitHeight);
                        ctx.setLineDash([]);
                    }
                }
            }
        }
    }
} else if (plane.id === 'plane1') {
                        planeData.groups.forEach((group, groupIndex) => {
                            for (let row = 0; row < planeData.rows; row++) {
                                for (let col = 0; col < planeData.cols; col++) {
                                    const unit = group.units[row][col];
                                    const x = planeData.offsetX + group.startX + col * group.spacingX;
                                    const y = planeData.offsetY + group.startY + row * group.spacingY;

                                    if (planeData.visible && group.visible && unit.visible) {
                                        ctx.fillStyle = group.color;
                                        ctx.fillRect(x, y, state.defaultUnitWidth, state.defaultUnitHeight);
                                    } else {
                                        ctx.strokeStyle = group.color;
                                        ctx.setLineDash([5, 5]);
                                        ctx.strokeRect(x, y, state.defaultUnitWidth, state.defaultUnitHeight);
                                        ctx.setLineDash([]);
                                    }
                                }
                            }
                        });
                    }
                });

                ctx.restore();
                zoomLabel.textContent = `縮放: ${Math.round(state.zoom * 100)}%`;
            }

            // Update state
function updateState() {
    console.log('Updating state');
    state.defaultUnitWidth = parseInt(document.getElementById('defaultUnitWidth').value) || 70;
    state.defaultUnitHeight = parseInt(document.getElementById('defaultUnitHeight').value) || 70;

    // Update Plane 1 (unchanged)
    state.plane1.visible = !document.getElementById('plane1Hidden').checked;
    const plane1Rows = parseInt(document.getElementById('plane1Rows').value) || 5;
    const plane1Cols = parseInt(document.getElementById('plane1Cols').value) || 5;
    state.plane1.rows = Math.min(Math.max(plane1Rows, 1), 50);
    state.plane1.cols = Math.min(Math.max(plane1Cols, 1), 50);
    state.plane1.moveMode = document.getElementById('plane1MoveMode').value;

    for (let i = 0; i < 3; i++) {
        const groupIndex = i + 1;
        const group = state.plane1.groups[i];
        group.visible = !document.getElementById(`group${groupIndex}Hidden`).checked;
        group.startX = parseInt(document.getElementById(`group${groupIndex}StartX`).value) || 0;
        group.startY = parseInt(document.getElementById(`group${groupIndex}StartY`).value) || 0;
        group.spacingX = parseInt(document.getElementById(`group${groupIndex}SpacingX`).value) || 400;
        group.spacingY = parseInt(document.getElementById(`group${groupIndex}SpacingY`).value) || 400;

        const newUnits = Array(state.plane1.rows).fill().map((_, row) =>
            Array(state.plane1.cols).fill().map((_, col) => {
                const id = `plane1-group${groupIndex}-${row}-${col}`;
                const existingUnit = group.units[row] && group.units[row][col];
                return {
                    id,
                    visible: existingUnit ? existingUnit.visible : (groupIndex === 1 && row === 0 && col === 0)
                };
            })
        );
        group.units = newUnits;
    }

    // Update Plane 2
    state.plane2.visible = !document.getElementById('plane2Hidden').checked;
    state.plane2.resetAfterGroup = document.getElementById('plane2ResetAfterGroup').checked;
    const plane2BigRows = parseInt(document.getElementById('plane2BigRows').value) || 2;
    const plane2BigCols = parseInt(document.getElementById('plane2BigCols').value) || 2;
    const plane2Rows = parseInt(document.getElementById('plane2Rows').value) || 5;
    const plane2Cols = parseInt(document.getElementById('plane2Cols').value) || 5;
    state.plane2.bigRows = Math.min(Math.max(plane2BigRows, 1), 50);
    state.plane2.bigCols = Math.min(Math.max(plane2BigCols, 1), 50);
    state.plane2.rows = Math.min(Math.max(plane2Rows, 1), 50);
    state.plane2.cols = Math.min(Math.max(plane2Cols, 1), 50);
    state.plane2.startX = parseInt(document.getElementById('plane2StartX').value) || 0;
    state.plane2.startY = parseInt(document.getElementById('plane2StartY').value) || 0;
    state.plane2.spacingX = parseInt(document.getElementById('plane2SpacingX').value) || 200;
    state.plane2.spacingY = parseInt(document.getElementById('plane2SpacingY').value) || 200;
    state.plane2.bigMoveMode = document.getElementById('plane2BigMoveMode').value; // New
    state.plane2.smallMoveMode = document.getElementById('plane2SmallMoveMode').value; // Updated

    const newPlane2Units = Array(state.plane2.bigRows).fill().map((_, bigRow) =>
        Array(state.plane2.bigCols).fill().map((_, bigCol) =>
            Array(state.plane2.rows).fill().map((_, row) =>
                Array(state.plane2.cols).fill().map((_, col) => {
                    const id = `plane2-${bigRow}-${bigCol}-${row}-${col}`;
                    const existingUnit = state.plane2.units[bigRow]?.[bigCol]?.[row]?.[col];
                    return {
                        id,
                        visible: existingUnit ? existingUnit.visible : !(bigRow === 0 && bigCol === 0 && row === 0 && col === 0),
                        color: existingUnit?.color ?? 'rgba(128, 128, 128, 0.7)' // Gray
                    };
                })
            )
        )
    );
    state.plane2.units = newPlane2Units;

    state.plane1.sequenceIndex = 0;
    state.plane1.groupIndex = 0;
    state.plane2.sequenceIndex = 0;

    updateCanvas();
}
            // Check if point is in plane
            function isPointInPlane(x, y, planeData) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                const padding = 10;

                if (planeData === state.plane2) {
                    for (let bigRow = 0; bigRow < planeData.bigRows; bigRow++) {
                        for (let bigCol = 0; bigCol < planeData.bigCols; bigCol++) {
                            for (let row = 0; row < planeData.rows; row++) {
                                for (let col = 0; col < planeData.cols; col++) {
                                    const unitX = planeData.offsetX + planeData.startX + (bigCol * planeData.cols + col) * planeData.spacingX;
                                    const unitY = planeData.offsetY + planeData.startY + (bigRow * planeData.rows + row) * planeData.spacingY;
                                    minX = Math.min(minX, unitX);
                                    minY = Math.min(minY, unitY);
                                    maxX = Math.max(maxX, unitX + state.defaultUnitWidth);
                                    maxY = Math.max(maxY, unitY + state.defaultUnitHeight);
                                }
                            }
                        }
                    }
                } else if (planeData === state.plane1) {
                    planeData.groups.forEach(group => {
                        for (let row = 0; row < planeData.rows; row++) {
                            for (let col = 0; col < planeData.cols; col++) {
                                const unitX = planeData.offsetX + group.startX + col * group.spacingX;
                                const unitY = planeData.offsetY + group.startY + row * group.spacingY;
                                minX = Math.min(minX, unitX);
                                minY = Math.min(minY, unitY);
                                maxX = Math.max(maxX, unitX + state.defaultUnitWidth);
                                maxY = Math.max(maxY, unitY + state.defaultUnitHeight);
                            }
                        }
                    });
                }

                minX -= padding;
                minY -= padding;
                maxX += padding;
                maxY += padding;

                return x >= minX && x <= maxX && y >= minY && y <= maxY;
            }

            // Find units at point
            function findUnitsAtPoint(x, y) {
                const units = [];

                const plane1Data = state.plane1;
                for (let groupIndex = 0; groupIndex < plane1Data.groups.length; groupIndex++) {
                    const group = plane1Data.groups[groupIndex];
                    for (let row = 0; row < plane1Data.rows; row++) {
                        for (let col = 0; col < plane1Data.cols; col++) {
                            const unitX = plane1Data.offsetX + group.startX + col * group.spacingX;
                            const unitY = plane1Data.offsetY + group.startY + row * group.spacingY;
                            if (
                                x >= unitX && x <= unitX + state.defaultUnitWidth &&
                                y >= unitY && y <= unitY + state.defaultUnitHeight
                            ) {
                                units.push({
                                    plane: 'plane1',
                                    groupIndex,
                                    row,
                                    col
                                });
                            }
                        }
                    }
                }

                const plane2Data = state.plane2;
                for (let bigRow = 0; bigRow < plane2Data.bigRows; bigRow++) {
                    for (let bigCol = 0; bigCol < plane2Data.bigCols; bigCol++) {
                        for (let row = 0; row < plane2Data.rows; row++) {
                            for (let col = 0; col < plane2Data.cols; col++) {
                                const unitX = plane2Data.offsetX + plane2Data.startX + (bigCol * plane2Data.cols + col) * plane2Data.spacingX;
                                const unitY = plane2Data.offsetY + plane2Data.startY + (bigRow * plane2Data.rows + row) * plane2Data.spacingY;
                                if (
                                    x >= unitX && x <= unitX + state.defaultUnitWidth &&
                                    y >= unitY && y <= unitY + state.defaultUnitHeight
                                ) {
                                    units.push({
                                        plane: 'plane2',
                                        bigRow,
                                        bigCol,
                                        row,
                                        col
                                    });
                                }
                            }
                        }
                    }
                }

                return units;
            }

            // Select plane
            function selectPlane(x, y) {
                const topPlaneId = getTopPlane();
                const topPlaneData = topPlaneId === 'plane1' ? state.plane1 : state.plane2;
                if (topPlaneData.visible && isPointInPlane(x, y, topPlaneData)) {
                    return null;
                }

                const otherPlaneId = topPlaneId === 'plane1' ? 'plane2' : 'plane1';
                const otherPlaneData = otherPlaneId === 'plane1' ? state.plane1 : state.plane2;
                if (otherPlaneData.visible && isPointInPlane(x, y, otherPlaneData)) {
                    const units = findUnitsAtPoint(x, y);
                    if (units.length === 0) {
                        return otherPlaneId;
                    }
                }

                return null;
            }

            // Get top plane
            function getTopPlane() {
                return state.plane1.zIndex > state.plane2.zIndex ? 'plane1' : 'plane2';
            }

            // Bring plane to front
            function bringPlaneToFront(planeId) {
                console.log(`Bringing ${planeId} to front`);
                if (planeId === 'plane1') {
                    state.plane1.zIndex = 1;
                    state.plane2.zIndex = 0;
                } else if (planeId === 'plane2') {
                    state.plane2.zIndex = 1;
                    state.plane1.zIndex = 0;
                }
                state.highlightedPlane = planeId;
                updateCanvas();
            }

            // Show context menu
            function showContextMenu(units, canvasX, canvasY, isBlankArea) {
                console.log('Showing context menu');
                contextMenu.innerHTML = '';

                if (isBlankArea) {
                    const plane1Item = document.createElement('div');
                    plane1Item.textContent = '將平面一設為最上層';
                    plane1Item.addEventListener('click', () => {
                        bringPlaneToFront('plane1');
                        contextMenu.style.display = 'none';
                    });
                    contextMenu.appendChild(plane1Item);

                    const plane2Item = document.createElement('div');
                    plane2Item.textContent = '將平面二設為最上層';
                    plane2Item.addEventListener('click', () => {
                        bringPlaneToFront('plane2');
                        contextMenu.style.display = 'none';
                    });
                    contextMenu.appendChild(plane2Item);
                } else {
                    units.forEach(unit => {
                        const planeName = unit.plane === 'plane1' ? `平面一 (組${unit.groupIndex + 1})` : `平面二 (大格${unit.bigRow}-${unit.bigCol})`;
                        const isVisible = unit.plane === 'plane1'
                            ? state.plane1.groups[unit.groupIndex].units[unit.row][unit.col].visible
                            : state.plane2.units[unit.bigRow][unit.bigCol][unit.row][unit.col].visible;
                        const actionText = isVisible ? '隱藏' : '顯示';

                        const menuItem = document.createElement('div');
                        menuItem.textContent = `${planeName} 單體：${actionText}`;
                        menuItem.addEventListener('click', () => {
                            if (unit.plane === 'plane1') {
                                state.plane1.groups[unit.groupIndex].units[unit.row][unit.col].visible =
                                    !state.plane1.groups[unit.groupIndex].units[unit.row][unit.col].visible;
                            } else {
                                state.plane2.units[unit.bigRow][unit.bigCol][unit.row][unit.col].visible =
                                    !state.plane2.units[unit.bigRow][unit.bigCol][unit.row][unit.col].visible;
                            }
                            updateCanvas();
                            contextMenu.style.display = 'none';
                        });
                        contextMenu.appendChild(menuItem);
                    });
                }

                if (contextMenu.children.length > 0) {
                    let menuX = canvasX / state.zoom;
                    let menuY = canvasY / state.zoom;

                    const menuWidth = 200;
                    const menuHeight = contextMenu.scrollHeight || 150;

                    if (menuX + menuWidth > canvas.width / state.zoom) {
                        menuX = canvas.width / state.zoom - menuWidth - 5;
                    }
                    if (menuY + menuHeight > canvas.height / state.zoom) {
                        menuY = canvas.height / state.zoom - menuHeight - 5;
                    }

                    contextMenu.style.left = `${menuX}px`;
                    contextMenu.style.top = `${menuY}px`;
                    contextMenu.style.display = 'block';
                }
            }

            // Hide context menu
            function hideContextMenu() {
                console.log('Hiding context menu');
                contextMenu.style.display = 'none';
            }

            // Event listeners
            togglePanelBtn.addEventListener('click', () => {
                console.log('Toggling control panel');
                controlPanel.classList.toggle('show');
                togglePanelBtn.textContent = controlPanel.classList.contains('show') ? '隱藏控制面板' : '顯示控制面板';
            });

            zoomInBtn.addEventListener('click', () => {
                console.log('Zooming in');
                state.zoom = Math.min(state.zoom + 0.1, 3);
                updateCanvas();
            });

            zoomOutBtn.addEventListener('click', () => {
                console.log('Zooming out');
                state.zoom = Math.max(state.zoom - 0.1, 0.5);
                updateCanvas();
            });

            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                console.log('Mouse wheel event');
                if (e.deltaY < 0) {
                    state.zoom = Math.min(state.zoom + 0.1, 3);
                } else {
                    state.zoom = Math.max(state.zoom - 0.1, 0.5);
                }
                updateCanvas();
            });

            canvas.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                console.log('Mouse down');
                hideContextMenu();
                const rect = canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left) / state.zoom;
                const y = (e.clientY - rect.top) / state.zoom;

                const selectedPlane = selectPlane(x, y);
                if (selectedPlane) {
                    bringPlaneToFront(selectedPlane);
                    state.activePlane = selectedPlane;
                } else {
                    state.activePlane = getTopPlane();
                }

                const planeData = state.activePlane === 'plane1' ? state.plane1 : state.plane2;
                planeData.isDragging = true;
                state.dragStartX = x - planeData.offsetX;
                state.dragStartY = y - planeData.offsetY;
            });

canvas.addEventListener('mousemove', function(e) {
    if (!state.activePlane) return;
    console.log('Mouse move');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom;
    const y = (e.clientY - rect.top) / state.zoom;
    const planeData = state.activePlane === 'plane1' ? state.plane1 : state.plane2;
    if (planeData.isDragging) {
        planeData.offsetX = x - state.dragStartX;
        planeData.offsetY = y - state.dragStartY;
        updateCanvas();
    }
});

            canvas.addEventListener('mouseup', function() {
                console.log('Mouse up');
                if (state.activePlane) {
                    const planeData = state.activePlane === 'plane1' ? state.plane1 : state.plane2;
                    if (planeData.isDragging) {
                        planeData.isDragging = false;
                        state.activePlane = null;
                    }
                    updateCanvas();
                }
            });

            canvas.addEventListener('mouseleave', function() {
                console.log('Mouse leave');
                if (state.activePlane) {
                    const planeData = state.activePlane === 'plane1' ? state.plane1 : state.plane2;
                    if (planeData.isDragging) {
                        planeData.isDragging = false;
                        state.activePlane = null;
                    }
                    updateCanvas();
                }
            });

            canvas.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                console.log('Context menu event');
                hideContextMenu();
                const rect = canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left) / state.zoom;
                const y = (e.clientY - rect.top) / state.zoom;
                const canvasX = e.clientX - rect.left;
                const canvasY = e.clientY - rect.top;

                const units = findUnitsAtPoint(x, y);

                if (units.length >= 1) {
                    units.forEach(unit => {
                        if (unit.plane === 'plane2') {
                            state.plane2.units[unit.bigRow][unit.bigCol][unit.row][unit.col].visible =
                                !state.plane2.units[unit.bigRow][unit.bigCol][unit.row][unit.col].visible;
                        } else if (unit.plane === 'plane1') {
                            state.plane1.groups[unit.groupIndex].units[unit.row][unit.col].visible =
                                !state.plane1.groups[unit.groupIndex].units[unit.row][unit.col].visible;
                        }
                    });
                    updateCanvas();
                } else {
                    const plane1Hit = isPointInPlane(x, y, state.plane1);
                    const plane2Hit = isPointInPlane(x, y, state.plane2);

                    if (plane1Hit || plane2Hit) {
                        state.plane1.visible = !state.plane1.visible;
                        state.plane2.visible = !state.plane2.visible;
                        updateCanvas();
                    } else {
                        showContextMenu([], canvasX, canvasY, true);
                    }
                }
            });

            document.addEventListener('click', function(e) {
                if (!contextMenu.contains(e.target) && e.target !== canvas) {
                    hideContextMenu();
                }
            });

            // Initialize buttons
            document.getElementById('updateBtn').addEventListener('click', () => {
                console.log('Update button clicked');
                updateState();
            });
            document.getElementById('stepMoveBtn').addEventListener('click', () => {
                console.log('Step move button clicked');
                stepMove();
            });
            document.getElementById('completeGroupBtn').addEventListener('click', () => {
                console.log('Complete group button clicked');
                completeCurrentGroup();
            });
            document.getElementById('resetOverlapBtn').addEventListener('click', () => {
                console.log('Reset overlap button clicked');
                resetOverlap();
            });

            // Bind input and select events
            const inputs = document.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    console.log(`Input changed: ${input.id}`);
                    updateState();
                });
            });

            // Window resize
            window.addEventListener('resize', resizeCanvas);

            // Initial setup
            console.log('Initializing canvas and overlap');
            resizeCanvas();
            resetOverlap();
            updateState();
        });
