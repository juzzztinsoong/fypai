yes, give me a patch plan to comprehensively implement the testing, ill go through the gaps you identified in order
critical:
 ai light behavior should be toggled using the main ai toggle in the application, which should then enforce the constraints in the study matrix, although that doesnt need to be followed to a tee. current implementation of rules is rather unwieldly, seeing that users do not need to be able to toggle individual rules, perhaps they should be hardcoded and toggleable. export package containing session specs can be easily fixed. good to structure metric collection, but if its too difficult i can manually do the inferring and data collection manually.
hard:
i need more details on condition signalling ui and what it entails
seeding shouldnt include any detail of scenario, should be verbally communicated to participants, session info should only contain like ab/ba or team number, which are already present

biggest issue is probably ensuring the ai-light mode is fully set up to fulfil research questions, let me know extent of matrix fulfilled.
minor issue would be ensuring the metric collection and packaging is improved, but i can do some of it through manual collection and analysis