import { nanoid } from "nanoid";
import {useState, useEffect} from "react"

export const useUsername = () => {
    const ANIMALS = [
        "wolf", "hawk", "Bear", "Tiger", "Lion", 
        "Eagle", "Fox", "Panther", "Shark", "Falcon"
    ];

const STORAGE_KEY = "chat_username";
const generateUsername = () => {
  const word = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `anonymous_${word}-${nanoid(5)}`;
};
    const [username, setUsername] = useState("")
    useEffect(() => {
        // Only access localStorage on client side
        if (typeof window === 'undefined') return;
        
        const main = () => {
          const stored = localStorage.getItem(STORAGE_KEY);
    
          if (stored) {
            setUsername(stored);
            return;
          }
    
          const generated = generateUsername();
          localStorage.setItem(STORAGE_KEY, generated);
          setUsername(generated);
        };
        main();
      }, []);
      return {username};
}