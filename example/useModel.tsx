import { useState, useEffect, useCallback } from "react";
import KeyWordRNBridge from "./rnkeywordspotter/KeyWordRNBridge";

type DetectionCallback = (event: any) => void;

/**
 * Custom hook for handling keyword detection using KeyWordRNBridge
 * @returns An object with functions and state for keyword detection
 */
export const useModel = () => {
    // State to track whether the keyword detection is currently active
    const [isListening, setIsListening] = useState(false);

    /**
     * Set the keyword detection license
     * @param licenseKey - The license key
     */
    // const setLicense = useCallback(async (licenseKey: any) => {
    //     try {
    //         await KeyWordRNBridge.setKeywordDetectionLicense(licenseKey);
    //     } catch (error) {
    //         console.error("[useModel] Error setting license:", error);
    //     }
    // }, []);

    /**
     * Load the keyword detection model
     * @param modelFileName - The name of the model file to load
     * @param threshold - The detection threshold
     * @param bufferCount - The number of audio buffers
     */
    const loadModel = useCallback(async () => {
        const modelFileNameOptions = {
            en: "help_me_now.onnx",
            es: "ayuda_urgente.onnx",
            he: "car_li_po.onnx",
        };
        try {

            const modelFileName = "sidekick_model.onnx";
            const threshold = 0.9999;
            const bufferCount = 2;
            const result = await KeyWordRNBridge.initKeywordDetection(
                modelFileName,
                threshold,
                bufferCount,
            );
            await KeyWordRNBridge.setKeywordDetectionLicense(
                "MTcyODkzOTYwMDAwMA==-XPLwWg6m4aFC9YMJZu0d0rKIh2AsExYixyeCpiVQmpE=",
            );
            console.log("Model loaded:", result);
        } catch (error) {
            console.error("[useModel] Error loading model:", error);
        }
    }, []);

    /**
     * Start listening for the keyword
     * @param callback - Function to be called when the keyword is detected
     */
    const startListening = useCallback(async (callback: DetectionCallback) => {
        try {
            // Set up the event listener for keyword detection
            const eventListener = KeyWordRNBridge.onKeywordDetectionEvent(
                (event: any) => {
                    callback(event);
                },
            );
            console.log("[useModel] eventListener", eventListener);
            // Start the phrase spotting
            KeyWordRNBridge.startKeywordDetection();
            // Update the listening state
            setIsListening(true);
        } catch (error) {
            console.error("Error starting keyword detection:", error);
        }
    }, []);

    /**
     * Stop listening for the keyword
     */
    const stopListening = useCallback(async () => {
        try {
            // Stop the phrase spotting
            KeyWordRNBridge.stopKeywordDetection();

            // Update the listening state
            setIsListening(false);
        } catch (error) {
            console.error("Error stopping keyword detection:", error);
        }
    }, []);

    /**
     * Cleanup effect to stop listening when the component unmounts
     * or when the isListening state changes
     */
    useEffect(() => {
        console.log("isListening updated:", isListening);
        return () => {
            if (isListening) {
                stopListening();
            }
        };
    }, [isListening, stopListening]);

    // Return an object with the necessary functions and state
    return {
        isListening,
        // setLicense,
        loadModel,
        startListening,
        stopListening,
    };
};

