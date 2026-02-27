document.addEventListener('DOMContentLoaded', () => {
    const excelFileInput = document.getElementById('excelFile');
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');
    const rectWidthInput = document.getElementById('rectWidth');
    const rectHeightInput = document.getElementById('rectHeight');
    const exportButton = document.getElementById('exportExcel');
    const templateEditorDiv = document.getElementById('templateEditor');
    const templatePointListUL = document.getElementById('templatePointList');
    const confirmTemplateChangesBtn = document.getElementById('confirmTemplateChanges');
    const clearTemplateBtn = document.getElementById('clearTemplate');
    const applyTemplateToAllBtn = document.getElementById('applyTemplateToAll');

    let pointsData = []; // { id, 光色, 組內順序, X座標, Y座標, originalX, originalY, isSelectedForTemplate, highlight }
    let panX = 0;
    let panY = 0;
    let scale = 1;
    const MIN_SCALE = 0.1;
    const MAX_SCALE = 10;

    let isPanning = false;
    let lastMouseX, lastMouseY;

    let isSelecting = false;
    let selectionStart = { x: 0, y: 0 };
    let selectionEnd = { x: 0, y: 0 };

    let currentTemplate = []; // Stores point objects that are part of the template
    let highlightedTemplatePointId = null; // For highlighting in canvas from list selection

    // --- Center point for managing editor visibility and resizing canvas ---
    function updateEditorVisibilityAndResize() {
        const editorShouldBeVisible = currentTemplate.length > 0;
        const editorIsCurrentlyVisible = templateEditorDiv.style.display !== 'none';

        if (editorShouldBeVisible) {
            populateTemplateEditor(); // Always populate/repopulate list if it should be visible
            if (!editorIsCurrentlyVisible) {
                templateEditorDiv.style.display = 'block';
                // Use setTimeout to ensure offsetWidth is correct in resizeCanvas
                setTimeout(resizeCanvas, 0);
            }
            // If editor was already visible, populateTemplateEditor updated its content.
            // No display change, so no need to trigger resizeCanvas for that reason.
        } else { // Editor should not be visible
            if (editorIsCurrentlyVisible) {
                templatePointListUL.innerHTML = ''; // Clear list content when hiding
                templateEditorDiv.style.display = 'none';
                // Use setTimeout to ensure offsetWidth is correct in resizeCanvas
                setTimeout(resizeCanvas, 0);
            }
            // If it was already hidden, do nothing.
        }
    }

    // --- Canvas Setup ---
    function resizeCanvas() {
        const controlsHeight = document.querySelector('.controls').offsetHeight;
        // Due to setTimeout, offsetWidth here should be the updated one
        const editorActualWidth = templateEditorDiv.style.display === 'none' ? 0 : templateEditorDiv.offsetWidth;
        
        canvas.width = window.innerWidth - editorActualWidth - 2; // -2 for canvas border
        canvas.height = window.innerHeight - controlsHeight - 2; // -2 for canvas border
        draw(); // Drawing is necessary because canvas dimensions changed
    }
    window.addEventListener('resize', resizeCanvas); // Keep this for window resize events

    // --- File Handling ---
    excelFileInput.addEventListener('change', handleFile);

    function handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            parseExcelData(jsonData);
            autoFitCanvas();
            // draw(); // autoFitCanvas will call draw
        };
        reader.readAsArrayBuffer(file);
    }

    function parseExcelData(data) {
        pointsData = [];
        if (data.length < 2) return; // Header + at least one data row

        const headers = data[0].map(h => String(h).trim()); // Ensure headers are strings
        const colorIndex = headers.indexOf('光色');
        const groupIndex = headers.indexOf('組內順序');
        const xIndex = headers.indexOf('X座標');
        const yIndex = headers.indexOf('Y座標');

        if (colorIndex === -1 || groupIndex === -1 || xIndex === -1 || yIndex === -1) {
            alert('Excel 欄位名稱不符 (需要: 光色, 組內順序, X座標, Y座標)');
            return;
        }

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue; // Skip empty rows
            
            const x = parseFloat(row[xIndex]);
            const y = parseFloat(row[yIndex]);
            if (!isNaN(x) && !isNaN(y)) {
                pointsData.push({
                    id: `p_${i-1}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // More unique ID
                    光色: row[colorIndex] || '',
                    組內順序: row[groupIndex] || '',
                    X座標: x,
                    Y座標: y,
                    originalX: x,
                    originalY: y,
                    isSelectedForTemplate: false,
                    highlight: false,
                });
            }
        }
        console.log("Parsed points:", pointsData);
    }

    function autoFitCanvas() {
        if (pointsData.length === 0) {
            scale = 1;
            panX = canvas.width / 2;
            panY = canvas.height / 2;
            draw();
            return;
        }

        let minX = pointsData[0].X座標, maxX = pointsData[0].X座標;
        let minY = pointsData[0].Y座標, maxY = pointsData[0].Y座標;

        pointsData.forEach(p => {
            minX = Math.min(minX, p.X座標);
            maxX = Math.max(maxX, p.X座標);
            minY = Math.min(minY, p.Y座標);
            maxY = Math.max(maxY, p.Y座標);
        });
        
        const dataWidth = maxX - minX;
        const dataHeight = maxY - minY;
        const padding = 50; // World units padding

        if (dataWidth === 0 && dataHeight === 0) { // Single point or all points at same location
             scale = 1;
        } else {
            const effectiveCanvasWidth = canvas.width - (2 * padding / scale); // Approximation
            const effectiveCanvasHeight = canvas.height - (2 * padding / scale);
            
            const scaleX = effectiveCanvasWidth / (dataWidth || 1); // Avoid division by zero
            const scaleY = effectiveCanvasHeight / (dataHeight || 1);
            scale = Math.min(scaleX, scaleY, MAX_SCALE) * 0.9; 
            scale = Math.max(scale, MIN_SCALE);
        }

        const centerX = minX + dataWidth / 2;
        const centerY = minY + dataHeight / 2;
        
        panX = canvas.width / 2 - centerX * scale;
        panY = canvas.height / 2 - centerY * scale;
        
        draw();
    }

    // --- Drawing ---
    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(scale, scale);

        const rectW = parseFloat(rectWidthInput.value) || 10;
        const rectH = parseFloat(rectHeightInput.value) || 10;

        pointsData.forEach(point => {
            drawPoint(point, rectW, rectH);
        });

        ctx.restore(); // Restore transform for selection rectangle

        if (isSelecting) {
            ctx.strokeStyle = 'rgba(0, 0, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 3]); // Dashed line for selection
            ctx.strokeRect(selectionStart.x, selectionStart.y, selectionEnd.x - selectionStart.x, selectionEnd.y - selectionStart.y);
            ctx.setLineDash([]); // Reset line dash
        }
    }

    function drawPoint(point, rectW, rectH) {
        let color = 'gray';
        switch (point.光色) {
            case 'R': color = 'rgba(255, 0, 0, 0.8)'; break;
            case 'G': color = 'rgba(0, 128, 0, 0.8)'; break;
            case 'B': color = 'rgba(0, 0, 255, 0.8)'; break;
            default: color = 'rgba(128, 128, 128, 0.7)';
        }

        ctx.fillStyle = color;
        ctx.fillRect(point.X座標 - rectW / 2, point.Y座標 - rectH / 2, rectW, rectH);
        
        if (point.highlight || (highlightedTemplatePointId === point.id)) {
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = Math.max(2 / scale, 0.5); // Ensure min lineWidth
            ctx.strokeRect(point.X座標 - rectW / 2 - 1/scale, point.Y座標 - rectH / 2 - 1/scale, rectW + 2/scale, rectH + 2/scale);
        }
         if (point.isSelectedForTemplate) {
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = Math.max(1.5 / scale, 0.3);
            ctx.beginPath();
            ctx.arc(point.X座標, point.Y座標, Math.max(rectW, rectH) / 1.8, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }

    rectWidthInput.addEventListener('change', draw);
    rectHeightInput.addEventListener('change', draw);

    // --- Canvas Interactions: Pan and Zoom ---
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isPanning = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            canvas.style.cursor = 'grabbing';
        } else if (e.button === 2) {
            e.preventDefault();
            isSelecting = true;
            const rect = canvas.getBoundingClientRect();
            selectionStart.x = e.clientX - rect.left;
            selectionStart.y = e.clientY - rect.top;
            selectionEnd.x = selectionStart.x;
            selectionEnd.y = selectionStart.y;
            draw(); // Draw immediately to show selection start
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            panX += dx;
            panY += dy;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            draw();
        } else if (isSelecting) {
            const rect = canvas.getBoundingClientRect();
            selectionEnd.x = e.clientX - rect.left;
            selectionEnd.y = e.clientY - rect.top;
            draw();
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0 && isPanning) {
            isPanning = false;
            canvas.style.cursor = 'grab';
        } else if (e.button === 2 && isSelecting) {
            isSelecting = false;
            defineTemplateFromSelection(); // This will call draw as needed
            // draw(); // No need to call draw here if defineTemplateFromSelection handles it
        }
    });

    canvas.addEventListener('mouseleave', () => {
        // If panning/selecting and mouse leaves, consider stopping the action
        // or handle re-entry. For simplicity, we can stop them.
        // if (isPanning) {
        //     isPanning = false;
        //     canvas.style.cursor = 'grab';
        // }
        // if (isSelecting) { // if mouse leaves during selection, finalize it
        //     isSelecting = false;
        //     defineTemplateFromSelection();
        // }
    });
    
    window.addEventListener('mouseup', (e) => { // Global mouseup to catch events outside canvas
        if (isPanning && e.button === 0) {
            isPanning = false;
            canvas.style.cursor = 'grab';
        }
        if (isSelecting && e.button === 2) {
            isSelecting = false;
            // Check if selection happened substantially on canvas before processing
            const rect = canvas.getBoundingClientRect();
            const endXOnCanvas = e.clientX >= rect.left && e.clientX <= rect.right;
            const endYOnCanvas = e.clientY >= rect.top && e.clientY <= rect.bottom;

            if ( (Math.abs(selectionStart.x - selectionEnd.x) > 5 || Math.abs(selectionStart.y - selectionEnd.y) > 5) ) {
                 defineTemplateFromSelection();
            } else {
                // Tiny selection, might be just a right click, clear selection visual
                draw();
            }
        }
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldMouseX = (mouseX - panX) / scale;
        const worldMouseY = (mouseY - panY) / scale;

        const zoomIntensity = 0.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        scale *= (1 + direction * zoomIntensity);
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

        panX = mouseX - worldMouseX * scale;
        panY = mouseY - worldMouseY * scale;
        
        draw();
    });
    
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // --- Coordinate Transformation ---
    function screenToWorld(screenX, screenY) {
        return {
            x: (screenX - panX) / scale,
            y: (screenY - panY) / scale
        };
    }

    // --- Template Logic ---
    function defineTemplateFromSelection() {
        currentTemplate = [];
        pointsData.forEach(p => p.isSelectedForTemplate = false); // Clear previous

        // Ensure selection has a minimal size to avoid accidental single-click templates
        if (Math.abs(selectionStart.x - selectionEnd.x) < 5 && Math.abs(selectionStart.y - selectionEnd.y) < 5) {
             updateEditorVisibilityAndResize(); // Hide editor if no real selection
             draw(); // Clear selection rect
             return;
        }

        const worldSelectionStart = screenToWorld(
            Math.min(selectionStart.x, selectionEnd.x),
            Math.min(selectionStart.y, selectionEnd.y)
        );
        const worldSelectionEnd = screenToWorld(
            Math.max(selectionStart.x, selectionEnd.x),
            Math.max(selectionStart.y, selectionEnd.y)
        );

        const rectW = (parseFloat(rectWidthInput.value) || 10) / 2;
        const rectH = (parseFloat(rectHeightInput.value) || 10) / 2;

        pointsData.forEach(point => {
            if (point.X座標 >= worldSelectionStart.x - rectW && point.X座標 <= worldSelectionEnd.x + rectW &&
                point.Y座標 >= worldSelectionStart.y - rectH && point.Y座標 <= worldSelectionEnd.y + rectH) {
                point.isSelectedForTemplate = true;
                currentTemplate.push(point);
            }
        });

        updateEditorVisibilityAndResize(); // This will show/hide editor and resize canvas
        draw(); // Redraw to show template selection highlights and clear selection rectangle
    }
    
    clearTemplateBtn.addEventListener('click', () => {
        currentTemplate.forEach(p => p.isSelectedForTemplate = false);
        currentTemplate = [];
        highlightedTemplatePointId = null;
        
        updateEditorVisibilityAndResize(); // This will hide editor and adjust canvas
        draw(); // Redraw canvas state
    });

    // populateTemplateEditor is now only responsible for filling the list, not display logic
      function populateTemplateEditor() {
        templatePointListUL.innerHTML = '';
        if (currentTemplate.length === 0) {
            // No need to change display or call resizeCanvas here, handled by updateEditorVisibilityAndResize
            return;
        }
        
        // 修改排序邏輯：先比較 X 座標，X 相同再比較 Y 座標
        currentTemplate.sort((a, b) => {
            if (a.X座標 === b.X座標) { // 如果 X 座標相同
                return a.Y座標 - b.Y座標; // 則比較 Y 座標 (升序)
            }
            return a.X座標 - b.X座標; // 否則比較 X 座標 (升序)
        });

        currentTemplate.forEach(point => {
            const li = document.createElement('li');
            li.dataset.pointId = point.id;
            // 將座標顯示的小數位數調整，看起來更整潔
            li.innerHTML = `
                <span>ID: ${point.id.substring(0,8)} (X:${point.X座標.toFixed(0)}, Y:${point.Y座標.toFixed(0)})</span><br>
                <label for="color-${point.id}">光色:</label>
                <select id="color-${point.id}" data-prop="光色">
                    <option value="" ${point.光色 === '' ? 'selected' : ''}>無</option>
                    <option value="R" ${point.光色 === 'R' ? 'selected' : ''}>R</option>
                    <option value="G" ${point.光色 === 'G' ? 'selected' : ''}>G</option>
                    <option value="B" ${point.光色 === 'B' ? 'selected' : ''}>B</option>
                </select><br>
                <label for="group-${point.id}">組內順序:</label>
                <input type="text" id="group-${point.id}" value="${point.組內順序}" data-prop="組內順序" size="10">
            `;
            
            li.addEventListener('click', () => {
                highlightedTemplatePointId = point.id;
                Array.from(templatePointListUL.children).forEach(item => item.classList.remove('highlighted-in-list'));
                li.classList.add('highlighted-in-list');
                draw();
            });

            const select = li.querySelector('select');
            const input = li.querySelector('input[type="text"]');

            select.addEventListener('change', (e) => updatePointInTemplate(point.id, '光色', e.target.value));
            input.addEventListener('input', (e) => updatePointInTemplate(point.id, '組內順序', e.target.value));
            
            templatePointListUL.appendChild(li);
        });
    }    

function createSpatialGrid(points, cellSize, epsilon) {
    const grid = new Map(); // Key: "x_y", Value: [point, point, ...]
    const cellRadiusForSearch = Math.ceil(epsilon / cellSize) + 1; // How many cells out to search due to epsilon

    points.forEach(point => {
        const cellX = Math.floor(point.X座標 / cellSize);
        const cellY = Math.floor(point.Y座標 / cellSize);
        const key = `${cellX}_${cellY}`;
        if (!grid.has(key)) {
            grid.set(key, []);
        }
        grid.get(key).push(point);
    });
    return { grid, cellSize, cellRadiusForSearch };
}
	
	function updatePointInTemplate(pointId, property, value) {
        const pointInPointsData = pointsData.find(p => p.id === pointId);
        if (pointInPointsData) {
            pointInPointsData[property] = value;
        }
        // No immediate redraw, changes are confirmed with a button or applied globally
    }
    
    confirmTemplateChangesBtn.addEventListener('click', () => {
        alert('模板變更已記錄 (直接修改於點位資料中)。');
        draw();
    });

    // --- Template Application Logic (Simplified) ---
    applyTemplateToAllBtn.addEventListener('click', applyTemplateToAllMatchingPoints);

       function applyTemplateToAllMatchingPoints() {
        if (currentTemplate.length === 0) {
            alert("請先定義一個模板。");
            return;
        }

        const startTime = performance.now(); // 計時開始

        // 1. 創建空間網格
        const epsilon = 0.1; // 與之前相同的容差
        // 選擇一個合理的 cellSize。可以基於數據的密度或 epsilon 的倍數。
        // 例如，如果點很密集，cellSize 可以小一些。如果點稀疏，可以大一些。
        // 一個經驗值可以是 epsilon 的幾倍，或者觀察數據的大致間距。
        // 這裡假設一個cellSize，可以根據實際情況調整
        let typicalSpacing = 10; // 假設點的典型間距，如果可以從數據估算更好
        if (currentTemplate.length > 1) {
            // 嘗試根據模板內點的距離估算
            let dxSum = 0, dySum = 0, count = 0;
            for(let i=0; i < currentTemplate.length; i++) {
                for(let j=i+1; j < currentTemplate.length; j++) {
                    dxSum += Math.abs(currentTemplate[i].X座標 - currentTemplate[j].X座標);
                    dySum += Math.abs(currentTemplate[i].Y座標 - currentTemplate[j].Y座標);
                    count++;
                }
            }
            if (count > 0) {
                const avgDx = dxSum / count;
                const avgDy = dySum / count;
                if (avgDx > epsilon * 2 && avgDy > epsilon * 2) { // 確保間距不是太小
                     typicalSpacing = Math.min(avgDx, avgDy) / 2; // 取平均間距的一半左右
                }
            }
        }
        const cellSize = Math.max(typicalSpacing, epsilon * 5, 10); // 確保cellSize不會太小
        
        console.log(`Using cellSize: ${cellSize.toFixed(2)} for spatial grid.`);
        const { grid, cellRadiusForSearch } = createSpatialGrid(pointsData, cellSize, epsilon);

        const templateAnchor = currentTemplate[0];
        const templateRelativePositions = currentTemplate.map(p => ({
            dx: p.X座標 - templateAnchor.X座標,
            dy: p.Y座標 - templateAnchor.Y座標,
            光色: p.光色,
            組內順序: p.組內順序,
        }));

        let applicationsCount = 0;
        const pointsAlreadyUsedInAnApplication = new Set(); // 追蹤已被用於某個模板實例的點

        pointsData.forEach(potentialAnchor => {
            // 跳過：1. 屬於原始模板定義的點 2. 已被用於其他模板實例的點
            if (currentTemplate.some(tp => tp.id === potentialAnchor.id) || pointsAlreadyUsedInAnApplication.has(potentialAnchor.id)) {
                return;
            }

            let allMatch = true;
            const matchedSetForThisAnchor = [potentialAnchor]; // 潛在錨點是第一個匹配
            const tempUsedInThisInstance = new Set([potentialAnchor.id]); // 追蹤此實例中已用的點

            for (let i = 1; i < templateRelativePositions.length; i++) {
                const relPos = templateRelativePositions[i];
                const targetX = potentialAnchor.X座標 + relPos.dx;
                const targetY = potentialAnchor.Y座標 + relPos.dy;

                let foundPointForThisRelPos = null;

                // 在目標單元格及周圍單元格中搜索
                const targetCellX = Math.floor(targetX / cellSize);
                const targetCellY = Math.floor(targetY / cellSize);

                candidatePointsLoop: // 標籤，用於跳出多重循環
                for (let dxCell = -cellRadiusForSearch; dxCell <= cellRadiusForSearch; dxCell++) {
                    for (let dyCell = -cellRadiusForSearch; dyCell <= cellRadiusForSearch; dyCell++) {
                        const checkCellX = targetCellX + dxCell;
                        const checkCellY = targetCellY + dyCell;
                        const key = `${checkCellX}_${checkCellY}`;

                        if (grid.has(key)) {
                            const pointsInCell = grid.get(key);
                            for (const p of pointsInCell) {
                                // 跳過：1. 屬於原始模板 2. 已在此實例中被使用
                                if (currentTemplate.some(tp => tp.id === p.id) || tempUsedInThisInstance.has(p.id)) {
                                    continue;
                                }
                                // 檢查座標是否在容差內
                                if (Math.abs(p.X座標 - targetX) < epsilon && Math.abs(p.Y座標 - targetY) < epsilon) {
                                    foundPointForThisRelPos = p;
                                    break candidatePointsLoop; // 找到一個就夠了，跳出所有單元格搜索循環
                                }
                            }
                        }
                    }
                }

                if (foundPointForThisRelPos) {
                    matchedSetForThisAnchor.push(foundPointForThisRelPos);
                    tempUsedInThisInstance.add(foundPointForThisRelPos.id);
                } else {
                    allMatch = false;
                    break; // 此相對位置無匹配，此錨點失敗
                }
            }
            
            if (allMatch && matchedSetForThisAnchor.length === currentTemplate.length) {
                applicationsCount++;
                matchedSetForThisAnchor.forEach((matchedPoint, index) => {
                    const correspondingTemplatePointInfo = templateRelativePositions[index];
                    matchedPoint.光色 = correspondingTemplatePointInfo.光色;
                    matchedPoint.組內順序 = correspondingTemplatePointInfo.組內順序;
                    matchedPoint.highlight = true;
                    pointsAlreadyUsedInAnApplication.add(matchedPoint.id); // 標記為已使用
                });
                // console.log("Applied template based on anchor:", potentialAnchor.id, "to set:", matchedSetForThisAnchor.map(p=>p.id));
            }
        });

        const endTime = performance.now();
        console.log(`Template application took ${((endTime - startTime) / 1000).toFixed(3)} seconds.`);

        draw();
        alert(`模板已嘗試應用到 ${applicationsCount} 個位置。\n符合條件並被修改的點位已高光顯示。`);
        
        setTimeout(() => {
            pointsData.forEach(p => p.highlight = false);
            draw();
        }, 3000);
    }
    // --- Export to Excel ---
    exportButton.addEventListener('click', () => {
        if (pointsData.length === 0) {
            alert('沒有數據可以匯出。');
            return;
        }

        const dataToExport = [
            ['光色', '組內順序', 'X座標', 'Y座標']
        ];

        pointsData.forEach(p => {
            dataToExport.push([
                p.光色,
                p.組內順序,
                p.X座標,
                p.Y座標
            ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "座標數據");
        XLSX.writeFile(workbook, "exported_coordinates.xlsx", { bookType: 'xlsx', type: 'binary' });
    });

    // Initial setup
    updateEditorVisibilityAndResize(); // Initially hide editor if no template
    resizeCanvas(); // Call resizeCanvas to set initial size and draw
    // draw(); // resizeCanvas will call draw, autoFitCanvas will call draw
});
