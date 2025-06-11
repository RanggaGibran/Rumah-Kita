import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  increment,
  limit as firestoreLimit
} from "firebase/firestore";
import { firestore } from "./config";
import { v4 as uuidv4 } from 'uuid';
import { Pet, PetInteraction, PetMood, PetType, PetInteractionType } from "../../types/pet";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Create new pet
export const createPet = async (
  homeId: string, 
  userId: string, 
  name: string, 
  type: PetType, 
  personality: string,
  imageUrl?: string
) => {
  try {
    const petData: Pet = {
      id: uuidv4(),
      homeId,
      name,
      type,
      personality,
      mood: 'content',
      energy: 100,
      lastInteraction: new Date(),
      lastFed: new Date(),
      lastCleaned: new Date(),
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      imageUrl
    };    // Prepare data for Firestore with proper handling of undefined values
    let firestoreData: any = {
      ...petData,
      lastInteraction: Timestamp.fromDate(petData.lastInteraction),
      lastFed: Timestamp.fromDate(petData.lastFed),
      lastCleaned: Timestamp.fromDate(petData.lastCleaned),
      createdAt: Timestamp.fromDate(petData.createdAt),
      updatedAt: Timestamp.fromDate(petData.updatedAt),
    };
    
    // Remove undefined values that Firestore doesn't accept
    if (firestoreData.imageUrl === undefined) {
      delete firestoreData.imageUrl;
    }

    const petRef = doc(firestore, "pets", petData.id);
    await setDoc(petRef, firestoreData);

    return { pet: petData, error: null };
  } catch (error: any) {
    return { pet: null, error: error.message };
  }
};

// Get all pets in a home
export const getHomePets = async (homeId: string) => {
  try {
    const petsRef = collection(firestore, "pets");
    const q = query(
      petsRef, 
      where("homeId", "==", homeId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    
    const pets: Pet[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      pets.push({
        ...data,
        lastInteraction: data.lastInteraction.toDate(),
        lastFed: data.lastFed.toDate(),
        lastCleaned: data.lastCleaned.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Pet);
    });
    
    return { pets, error: null };
  } catch (error: any) {
    return { pets: [], error: error.message };
  }
};

// Get specific pet
export const getPetById = async (petId: string) => {
  try {
    const petRef = doc(firestore, "pets", petId);
    const petDoc = await getDoc(petRef);
    
    if (!petDoc.exists()) {
      return { pet: null, error: "Pet tidak ditemukan" };
    }
    
    const data = petDoc.data();
    const pet: Pet = {
      ...data,
      lastInteraction: data.lastInteraction.toDate(),
      lastFed: data.lastFed.toDate(),
      lastCleaned: data.lastCleaned.toDate(),
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    } as Pet;
    
    return { pet, error: null };
  } catch (error: any) {
    return { pet: null, error: error.message };
  }
};

// Update pet
export const updatePet = async (petId: string, updates: Partial<Pet>) => {
  try {
    const petRef = doc(firestore, "pets", petId);
    const updateData: any = {
      updatedAt: Timestamp.fromDate(new Date()),
    };

    // Add all updates to updateData
    Object.keys(updates).forEach(key => {
      const value = updates[key as keyof Pet];
      if (value !== undefined) {
        // Convert Date objects to Timestamps for Firestore
        if (value instanceof Date) {
          updateData[key] = Timestamp.fromDate(value);
        } else {
          updateData[key] = value;
        }
      }
    });
    
    await updateDoc(petRef, updateData);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Delete pet
export const deletePet = async (petId: string) => {
  try {
    const petRef = doc(firestore, "pets", petId);
    await deleteDoc(petRef);
    
    // Also delete all interactions for this pet
    const interactionsRef = collection(firestore, "petInteractions");
    const q = query(interactionsRef, where("petId", "==", petId));
    const querySnapshot = await getDocs(q);
    
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Subscribe to real-time updates for pets
export const subscribeToHomePets = (homeId: string, callback: (pets: Pet[]) => void) => {
  const petsRef = collection(firestore, "pets");
  const q = query(
    petsRef, 
    where("homeId", "==", homeId),
    orderBy("createdAt", "desc")
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const pets: Pet[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      pets.push({
        ...data,
        lastInteraction: data.lastInteraction.toDate(),
        lastFed: data.lastFed.toDate(),
        lastCleaned: data.lastCleaned.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Pet);
    });
    callback(pets);
  });
};

// Interact with pet
export const interactWithPet = async (
  petId: string, 
  userId: string, 
  interactionType: PetInteractionType, 
  message?: string
) => {
  try {
    // Create the interaction record
    const interactionId = uuidv4();
    const timestamp = new Date();
    
    // Get the pet to update its state
    const { pet, error } = await getPetById(petId);
    if (error || !pet) {
      return { success: false, error: error || "Pet tidak ditemukan", response: null };
    }
    
    // Generate response using Gemini AI
    let response: string | undefined;
    
    try {
      const aiResponse = await generatePetResponse(pet, userId, interactionType, message);
      response = aiResponse;
    } catch (aiError: any) {
      console.error("Error generating AI response:", aiError);
      // Fallback responses if AI fails
      const fallbackResponses = {
        feed: [`${pet.name} menikmati makanannya dengan senang.`, `${pet.name} makan dengan lahap!`],
        clean: [`${pet.name} sekarang bersih dan segar.`, `${pet.name} terlihat lebih senang setelah dibersihkan.`],
        play: [`${pet.name} sangat senang bermain denganmu!`, `${pet.name} berlari-lari dengan gembira.`],
        pet: [`${pet.name} mengeluarkan suara senang.`, `${pet.name} menikmati belaianmu.`],
        talk: [`${pet.name} menatapmu dengan penuh perhatian.`, `${pet.name} sepertinya mengerti apa yang kamu katakan.`]
      };
      
      const options = fallbackResponses[interactionType];
      response = options[Math.floor(Math.random() * options.length)];
    }
    
    // Create interaction record
    const interactionData: PetInteraction = {
      id: interactionId,
      petId,
      userId,
      type: interactionType,
      timestamp,
      message,
      response
    };
    
    const interactionRef = doc(firestore, "petInteractions", interactionId);
    await setDoc(interactionRef, {
      ...interactionData,
      timestamp: Timestamp.fromDate(timestamp)
    });
    
    // Update pet state based on interaction
    const updates: Partial<Pet> = {
      lastInteraction: timestamp,
      updatedAt: timestamp
    };
    
    // Update specific stats based on interaction type
    switch (interactionType) {
      case 'feed':
        updates.lastFed = timestamp;
        updates.energy = Math.min(pet.energy + 30, 100);
        updates.mood = increaseMood(pet.mood);
        break;
      case 'clean':
        updates.lastCleaned = timestamp;
        updates.mood = increaseMood(pet.mood);
        break;
      case 'play':
        updates.energy = Math.max(pet.energy - 20, 10);
        updates.mood = increaseMood(pet.mood);
        break;
      case 'pet':
        updates.mood = increaseMood(pet.mood);
        break;
      case 'talk':
        // Mood might improve slightly just from talking
        if (Math.random() > 0.7) {
          updates.mood = increaseMood(pet.mood);
        }
        break;
    }
    
    await updatePet(petId, updates);
    
    return { 
      success: true, 
      error: null, 
      response,
      interaction: interactionData
    };
  } catch (error: any) {
    return { success: false, error: error.message, response: null };
  }
};

// Get interactions for a pet
export const getPetInteractions = async (petId: string, limitCount: number = 10) => {
  try {
    const interactionsRef = collection(firestore, "petInteractions");
    const q = query(
      interactionsRef, 
      where("petId", "==", petId),
      orderBy("timestamp", "desc"),
      firestoreLimit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const interactions: PetInteraction[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      interactions.push({
        ...data,
        timestamp: data.timestamp.toDate()
      } as PetInteraction);
    });
    
    return { interactions, error: null };
  } catch (error: any) {
    return { interactions: [], error: error.message };
  }
};

// Subscribe to pet interactions
export const subscribeToPetInteractions = (petId: string, callback: (interactions: PetInteraction[]) => void, limitCount: number = 10) => {
  const interactionsRef = collection(firestore, "petInteractions");
  const q = query(
    interactionsRef, 
    where("petId", "==", petId),
    orderBy("timestamp", "desc"),
    firestoreLimit(limitCount)
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const interactions: PetInteraction[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      interactions.push({
        ...data,
        timestamp: data.timestamp.toDate()
      } as PetInteraction);
    });
    callback(interactions);
  });
};

// Update pet states automatically (for server-side functions)
// This would normally run in a cloud function on a schedule
export const updateAllPetStates = async (homeId: string) => {
  try {
    const { pets, error } = await getHomePets(homeId);
    if (error) return { success: false, error };
    
    const now = new Date();
    const updates = pets.map(pet => {
      // Calculate how long since last interactions
      const hoursSinceLastFed = (now.getTime() - pet.lastFed.getTime()) / (1000 * 60 * 60);
      const hoursSinceLastCleaned = (now.getTime() - pet.lastCleaned.getTime()) / (1000 * 60 * 60);
      
      const updates: Partial<Pet> = {};
      
      // Decrease energy based on time since last fed
      if (hoursSinceLastFed > 24) {
        updates.energy = Math.max(pet.energy - 5 * Math.floor(hoursSinceLastFed / 24), 0);
      }
      
      // Lower mood if pet hasn't been fed or cleaned
      if (hoursSinceLastFed > 48 || hoursSinceLastCleaned > 72) {
        updates.mood = decreaseMood(pet.mood);
      }
      
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now;
        return updatePet(pet.id, updates);
      }
      
      return Promise.resolve({ success: true, error: null });
    });
    
    await Promise.all(updates);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Helper function to increase mood state
const increaseMood = (currentMood: PetMood): PetMood => {
  switch (currentMood) {
    case 'angry': return 'sad';
    case 'sad': return 'neutral';
    case 'neutral': return 'content';
    case 'content': return 'happy';
    case 'happy': return 'happy';
    default: return currentMood;
  }
};

// Helper function to decrease mood state
const decreaseMood = (currentMood: PetMood): PetMood => {
  switch (currentMood) {
    case 'happy': return 'content';
    case 'content': return 'neutral';
    case 'neutral': return 'sad';
    case 'sad': return 'angry';
    case 'angry': return 'angry';
    default: return currentMood;
  }
};

// Gemini AI integration for generating pet responses
const generatePetResponse = async (
  pet: Pet, 
  userId: string, 
  interactionType: PetInteractionType, 
  message?: string
): Promise<string> => {
  try {
    // Check if we have a valid Gemini API key
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("REACT_APP_GEMINI_API_KEY not found. Using fallback responses.");
      return generateFallbackResponse(pet, interactionType, message);
    }
    
    // Initialize the Gemini AI with API key
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Create a prompt based on pet personality and interaction
    let prompt = `You are ${pet.name}, a ${pet.personality} ${pet.type}. 
    Your current mood is ${pet.mood} and your energy level is ${pet.energy}/100.
    You've been interacted with in this way: ${interactionType}.`;

    if (message && interactionType === 'talk') {
      prompt += ` A human just said to you: "${message}".`;
    }
    
    prompt += ` Respond as this pet would, in a very brief, playful way in Bahasa Indonesia. Keep the response under 200 characters.`;

    // Generate a response from Gemini AI
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    return response;
  } catch (error) {
    console.error("Error generating pet response:", error);
    return generateFallbackResponse(pet, interactionType, message);
  }
};

// Fallback response generator for when Gemini API is unavailable
const generateFallbackResponse = (
  pet: Pet,
  interactionType: PetInteractionType,
  message?: string
): string => {
  // Fallback implementation with pre-defined responses
  const responses = {
    feed: [
      `${pet.name} menikmati makanannya dengan senang!`,
      `${pet.name} melahap makanannya dengan cepat. Sepertinya dia sangat lapar!`,
      `${pet.name} mengeluarkan suara senang sambil makan.`
    ],
    clean: [
      `${pet.name} terlihat segar dan bersih sekarang.`,
      `${pet.name} menikmati saat-saat dibersihkan dan membalas dengan suara gembira.`,
      `${pet.name} berputar-putar setelah dibersihkan, menunjukkan betapa senangnya dia.`
    ],
    play: [
      `${pet.name} melompat kegirangan saat bermain!`,
      `${pet.name} terlihat sangat bersemangat dan aktif.`,
      `${pet.name} berlari-lari dengan gembira, sepertinya dia sangat menikmati waktunya bermain.`
    ],
    pet: [
      `${pet.name} mengeluarkan suara senang saat dibelai.`,
      `${pet.name} mendekat dan menikmati perhatian yang kamu berikan.`,
      `${pet.name} terlihat sangat nyaman dengan belaian lembut darimu.`
    ],
    talk: [
      `${pet.name} memiringkan kepalanya, sepertinya memperhatikan kata-katamu.`,
      `${pet.name} menatapmu dengan mata berbinar, seolah mengerti apa yang kamu katakan.`
    ]
  };
  
  // If there's a message during talk interaction, create more personalized response
  if (interactionType === 'talk' && message) {
    if (message.toLowerCase().includes('halo') || message.toLowerCase().includes('hai')) {
      return `${pet.name} sepertinya mengenali sapaan dan membalas dengan suara khasnya!`;
    }
    if (message.toLowerCase().includes('main')) {
      return `${pet.name} terlihat sangat bersemangat mendengar kata 'main' dan bersiap-siap untuk bermain!`;
    }
    if (message.toLowerCase().includes('makan')) {
      return `${pet.name} mendengar kata 'makan' dan segera menghampirimu dengan penuh harapan!`;
    }
    
    // Generic response for other messages
    return `${pet.name} mendengarkan dengan penuh perhatian, matanya berkedip pelan seolah memproses kata-katamu.`;
  }
  
  // For other interaction types, pick a random response
  const options = responses[interactionType];
  return options[Math.floor(Math.random() * options.length)];
};
