Run the bot testing system to test the lootbox game and provide analysis.

## Instructions

1. Run the bot tests using: `npx tsx src/bot-test.ts 5 2000`

2. After the tests complete, provide:
   - A summary of the test results (bugs found, actions performed)
   - Analysis of the final game state averages

3. Based on the bot's gameplay experience and the game mechanics in `src/App.tsx`, suggest **5 possible improvements** to the game. Consider:
   - Balance issues (is progression too slow/fast?)
   - Missing features the bots couldn't test
   - Quality of life improvements
   - Potential exploits or edge cases
   - Features that feel underdeveloped

4. Format your response with clear sections for:
   - Test Results Summary
   - Bot Gameplay Analysis
   - Suggested Improvements (numbered list with explanations)
