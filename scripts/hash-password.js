import { hashPassword } from '../src/security.js';

if (!process.stdin.isTTY) {
  let password='';
  for await (const chunk of process.stdin) password+=chunk;
  password=password.replace(/\r?\n$/, '');
  if(!password||password.length>256)throw new Error('Enter a password of 1–256 characters.');
  console.log(await hashPassword(password));
} else {
  process.stdout.write('Admin password (hidden): ');
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
  let password='';
  process.stdin.on('data',async chunk=>{
    for (const character of chunk) {
      if(character==='\u0003'){process.stdout.write('\n');process.stdin.setRawMode(false);process.exit(130);}
      else if(character==='\r'||character==='\n'){
        process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');
        if(!password||password.length>256){console.error('Enter a password of 1–256 characters.');process.exit(1);}
        console.log(await hashPassword(password));process.exit(0);
      } else if(character==='\u007f')password=password.slice(0,-1);
      else password+=character;
    }
  });
}
