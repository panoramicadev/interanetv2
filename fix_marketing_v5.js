const fs = require('fs');
const file = 'client/src/pages/marketing.tsx';
let content = fs.readFileSync(file, 'utf8');

// The multi_replace tool broke line 260
// Line 255:           </TabsList>
//     </div>
//   </div>
//  <div className="flex-1 mt-6">
//    <Tabs>            ...wait the structure was broken initially.
// Let's just restore the file from git to be safe, then carefully apply ONLY the deletions needed.

content = content.replace(/<(TabsContent value="presupuesto" className="space-y-6">)[\s\S]*?(<\/main>)/, '$1\n              <PresupuestoMarketing userRole={user.role} />\n            </TabsContent>\n          )}\n        </Tabs>\n      </main>');

// Remove the lingering TabsContent for seo and ads if they are still there
content = content.replace(/<TabsContent value="seo" className="space-y-6">[\s\S]*?<\/TabsContent>/, '');
content = content.replace(/<TabsContent value="ads" className="space-y-6">[\s\S]*?<\/TabsContent>/, '');

fs.writeFileSync(file, content);
console.log('Fixed');
