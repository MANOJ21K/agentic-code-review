document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-upload');
    const runInfo = document.getElementById('run-info');
    const template = document.getElementById('finding-template');
    
    const statRaw = document.getElementById('stat-raw');
    const statFiltered = document.getElementById('stat-filtered');
    const statFinal = document.getElementById('stat-final');
    const statTokens = document.getElementById('stat-tokens');
    const statCost = document.getElementById('stat-cost');
    
    const finalList = document.getElementById('final-list');
    const rawList = document.getElementById('raw-list');
    const filteredList = document.getElementById('filtered-list');
    const agentTabs = document.getElementById('agent-tabs');
    
    let currentData = null;

    const AGENT_MODELS = {
        'bug-hunter': 'opus',
        'security-reviewer': 'opus',
        'compliance-reviewer': 'sonnet',
        'history-analyst': 'sonnet',
        'test-coverage-reviewer': 'sonnet',
        'pr-gatekeeper': 'haiku',
        'context-scout': 'haiku'
    };

    // Prices per 1M tokens
    const MODEL_PRICING = {
        'haiku': { input: 1.00, output: 5.00 },
        'sonnet': { input: 3.00, output: 15.00 },
        'opus': { input: 5.00, output: 25.00 }
    };

    // Handle file upload
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                renderDashboard(data);
            } catch (err) {
                alert('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
    });

    // Handle CSV Export
    const exportBtn = document.getElementById('export-csv');
    exportBtn.addEventListener('click', () => {
        if (!currentData || !currentData.raw_findings) {
            alert('Please load a run first.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Agent,Category,Confidence,Summary,Location\n";

        Object.entries(currentData.raw_findings).forEach(([agent, findings]) => {
            findings.forEach(finding => {
                let parts;
                if (typeof finding === 'string') {
                    parts = finding.split('|').map(s => s.trim());
                } else {
                    parts = [finding.location || '', finding.category || '', finding.confidence || '', finding.summary || ''];
                }
                
                if (parts.length >= 4) {
                    const loc = parts[0].replace(/"/g, '""');
                    const cat = parts[1].replace(/"/g, '""');
                    const conf = parts[2].replace(/"/g, '""');
                    const sum = parts[3].replace(/"/g, '""');
                    csvContent += `"${agent}","${cat}","${conf}","${sum}","${loc}"\n`;
                }
            });
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `telemetry-export-${currentData.run_id || 'latest'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Handle auto-load from a URL param (for the launcher command)
    const urlParams = new URLSearchParams(window.location.search);
    const dataUrl = urlParams.get('data');
    if (dataUrl) {
        fetch(dataUrl)
            .then(res => res.json())
            .then(data => renderDashboard(data))
            .catch(err => {
                runInfo.textContent = 'Failed to fetch telemetry from server.';
            });
    } else {
        runInfo.textContent = 'Please load a JSON run file.';
    }

    function renderDashboard(data) {
        currentData = data;
        runInfo.textContent = `Run: ${data.run_id || 'Unknown'} | Target: ${data.target || 'Unknown'}`;
        
        let rawCount = 0;
        let totalOutputChars = 0;
        let totalCost = 0.0;
        let totalTokens = 0;
        
        // Use provided metadata, default to 5000 chars for diff+context if missing
        const diffChars = data.metadata?.diff_chars || 4000;
        const contextChars = data.metadata?.context_chars || 1000;
        const baseInputChars = diffChars + contextChars;

        if (data.raw_findings) {
            Object.entries(data.raw_findings).forEach(([agent, findings]) => {
                rawCount += findings.length;
                
                // Count output chars for this agent
                let agentOutputChars = 0;
                findings.forEach(f => {
                    agentOutputChars += (typeof f === 'string' ? f.length : JSON.stringify(f).length);
                });
                
                totalOutputChars += agentOutputChars;
                
                // Calculate cost for this agent
                const modelKey = AGENT_MODELS[agent] || 'sonnet';
                const pricing = MODEL_PRICING[modelKey];
                
                const agentInputTokens = baseInputChars / 4;
                const agentOutputTokens = agentOutputChars / 4;
                
                totalTokens += (agentInputTokens + agentOutputTokens);
                
                const agentCost = (agentInputTokens / 1000000 * pricing.input) + (agentOutputTokens / 1000000 * pricing.output);
                totalCost += agentCost;
            });
        }
        
        const filteredCount = data.filtered_findings ? data.filtered_findings.length : 0;
        const finalCount = data.final_findings ? data.final_findings.length : 0;
        
        animateValue(statRaw, 0, rawCount, 1000);
        animateValue(statFiltered, 0, filteredCount, 1000);
        animateValue(statFinal, 0, finalCount, 1000);
        animateValue(statTokens, 0, Math.round(totalTokens), 1000);
        
        // Animate cost (requires float logic)
        animateFloat(statCost, 0, totalCost, 1000, '$');

        // Render Final
        renderList(finalList, data.final_findings || [], false);
        
        // Render Filtered
        renderList(filteredList, data.filtered_findings || [], true);

        // Render Agent Tabs & Raw
        renderAgentTabs(data.raw_findings || {});
    }

    function animateFloat(obj, start, end, duration, prefix = '') {
        let startTimestamp = null;
        // easeOutExpo easing function
        const easeOutExpo = (x) => {
            return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
        };
        
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easedProgress = easeOutExpo(progress);
            
            const current = (easedProgress * (end - start) + start).toFixed(4);
            obj.innerHTML = prefix + current;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = prefix + end.toFixed(4); // Ensure exact final value
            }
        };
        window.requestAnimationFrame(step);
    }

    function renderAgentTabs(rawFindingsMap) {
        agentTabs.innerHTML = '';
        const agents = Object.keys(rawFindingsMap);
        
        if (agents.length === 0) {
            rawList.innerHTML = '<div class="empty-state">No raw findings.</div>';
            return;
        }

        agents.forEach((agent, index) => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
            btn.textContent = `${agent} (${rawFindingsMap[agent].length})`;
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderList(rawList, rawFindingsMap[agent], false);
            };
            agentTabs.appendChild(btn);
        });

        // Initial render of first agent
        renderList(rawList, rawFindingsMap[agents[0]], false);
    }

    function renderList(container, items, isFiltered) {
        container.innerHTML = '';
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state">No findings.</div>';
            return;
        }

        items.forEach((item, idx) => {
            // Support both object format and raw pipe-delimited strings
            let finding = parseFinding(item);
            
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.finding-card');
            card.style.animationDelay = `${idx * 0.05}s`;
            card.classList.add('fade-in');

            clone.querySelector('.category-badge').textContent = finding.category || 'UNKNOWN';
            
            const confBadge = clone.querySelector('.conf-badge');
            const conf = parseInt(finding.confidence) || 0;
            confBadge.textContent = `${conf}/100`;
            if (conf < 70) confBadge.classList.add('low');
            else if (conf < 85) confBadge.classList.add('med');

            clone.querySelector('.finding-loc').textContent = finding.loc || 'N/A';
            clone.querySelector('.finding-summary').textContent = finding.summary || 'No summary provided.';

            if (isFiltered && finding.reason) {
                const reasonEl = clone.querySelector('.finding-reason');
                reasonEl.classList.remove('hidden');
                reasonEl.querySelector('.reason-text').textContent = finding.reason;
            }

            container.appendChild(clone);
        });
    }

    function parseFinding(item) {
        if (typeof item === 'object') {
            // Check if it has a 'raw' property containing the pipe string, or if it's fully structured
            if (item.raw && typeof item.raw === 'string') {
                const parsed = parsePipeString(item.raw);
                if (item.reason) parsed.reason = item.reason;
                return parsed;
            }
            return {
                loc: item.loc || item.fileLine,
                category: item.category,
                confidence: item.confidence,
                summary: item.summary,
                reason: item.reason
            };
        } else if (typeof item === 'string') {
            return parsePipeString(item);
        }
        return { summary: "Unparseable finding format." };
    }

    function parsePipeString(str) {
        // file:line | category | confidence | summary | scenario | fix
        const parts = str.split('|').map(s => s.trim());
        return {
            loc: parts[0] || 'Unknown',
            category: parts[1] || 'Unknown',
            confidence: parts[2] || '0',
            summary: parts[3] || 'Unknown'
        };
    }

    // Number animation
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const easeOutExpo = (x) => {
            return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
        };

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easedProgress = easeOutExpo(progress);
            
            obj.innerHTML = Math.floor(easedProgress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = end; // Ensure exact final value
            }
        };
        window.requestAnimationFrame(step);
    }
});
