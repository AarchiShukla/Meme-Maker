import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Upload, 
  Type, 
  Smile, 
  Download, 
  Undo, 
  Redo, 
  Trash2, 
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Share2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MemeElement {
  id: string;
  type: 'text' | 'emoji';
  content: string;
  x: number;
  y: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
  rotation?: number;
}

interface HistoryState {
  elements: MemeElement[];
  backgroundImage: string | null;
}

const Index = () => {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [elements, setElements] = useState<MemeElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([{ elements: [], backgroundImage: null }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [aiDescription, setAiDescription] = useState("");
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingElement, setEditingElement] = useState<string | null>(null);
  
  // Text controls
  const [fontSize, setFontSize] = useState(32);
  const [fontFamily, setFontFamily] = useState("impact");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const saveToHistory = useCallback((newElements: MemeElement[], newBackgroundImage: string | null) => {
    const newState = { elements: newElements, backgroundImage: newBackgroundImage };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setBackgroundImage(imageUrl);
        saveToHistory(elements, imageUrl);
        toast.success("Image uploaded successfully! 🎉");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    if (!backgroundImage) {
      fileInputRef.current?.click();
      return;
    }

    // Only deselect if clicking on empty canvas area
    if (event.target === event.currentTarget) {
      setSelectedElement(null);
      setEditingElement(null);
    }
  };

  const handleMouseDown = (event: React.MouseEvent, elementId: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    setSelectedElement(elementId);
    setIsDragging(true);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    const element = elements.find(el => el.id === elementId);
    
    if (rect && element) {
      const offsetX = event.clientX - rect.left - element.x;
      const offsetY = event.clientY - rect.top - element.y;
      setDragOffset({ x: offsetX, y: offsetY });
    }
  };

  const updateElement = useCallback((id: string, updates: Partial<MemeElement>) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    );
    setElements(newElements);
    if (!isDragging) {
      saveToHistory(newElements, backgroundImage);
    }
  }, [elements, backgroundImage, isDragging, saveToHistory]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !selectedElement || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = event.clientX - rect.left - dragOffset.x;
    const newY = event.clientY - rect.top - dragOffset.y;
    
    // Keep element within canvas bounds
    const constrainedX = Math.max(0, Math.min(newX, rect.width - 50));
    const constrainedY = Math.max(0, Math.min(newY, rect.height - 30));
    
    updateElement(selectedElement, { x: constrainedX, y: constrainedY });
  }, [isDragging, selectedElement, dragOffset, updateElement]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  // Global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const addText = () => {
    const newElement: MemeElement = {
      id: Date.now().toString(),
      type: 'text',
      content: 'Your Text Here',
      x: 50,
      y: 50,
      fontSize,
      fontFamily,
      color: textColor,
      textAlign
    };
    const newElements = [...elements, newElement];
    setElements(newElements);
    setSelectedElement(newElement.id);
    saveToHistory(newElements, backgroundImage);
    toast.success("Text added! Click to edit.");
  };

  const addEmoji = (emoji: string) => {
    const newElement: MemeElement = {
      id: Date.now().toString(),
      type: 'emoji',
      content: emoji,
      x: 100,
      y: 100,
      fontSize: 40
    };
    const newElements = [...elements, newElement];
    setElements(newElements);
    setSelectedElement(newElement.id);
    saveToHistory(newElements, backgroundImage);
    toast.success("Emoji added! 😄");
  };

  const deleteElement = (id: string) => {
    const newElements = elements.filter(el => el.id !== id);
    setElements(newElements);
    setSelectedElement(null);
    setEditingElement(null);
    saveToHistory(newElements, backgroundImage);
    toast.success("Element deleted!");
  };

  const handleTextEdit = (elementId: string, newContent: string) => {
    updateElement(elementId, { content: newContent });
    setEditingElement(null);
  };

  const handleDoubleClick = (elementId: string, elementType: string) => {
    if (elementType === 'text') {
      setEditingElement(elementId);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setElements(state.elements);
      setBackgroundImage(state.backgroundImage);
      setHistoryIndex(newIndex);
      setSelectedElement(null);
      toast.success("Undone!");
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setElements(state.elements);
      setBackgroundImage(state.backgroundImage);
      setHistoryIndex(newIndex);
      setSelectedElement(null);
      toast.success("Redone!");
    }
  };

  const generateCaption = async () => {
    if (!aiDescription.trim()) {
      toast.error("Please enter a description first!");
      return;
    }

    setIsGeneratingCaption(true);
    toast.loading("Cooking up a spicy caption...");

    try {
      const { data, error } = await supabase.functions.invoke('generate-caption', {
        body: { 
          description: aiDescription,
          type: 'generate'
        }
      });

      if (error) throw error;

      const caption = data.caption;
      const newElement: MemeElement = {
        id: Date.now().toString(),
        type: 'text',
        content: caption,
        x: canvasRef.current!.offsetWidth / 2 - 100,
        y: 50,
        fontSize,
        fontFamily,
        color: textColor,
        textAlign
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElement(newElement.id);
      saveToHistory(newElements, backgroundImage);
      
      toast.dismiss();
      toast.success("AI caption generated!");
    } catch (error) {
      console.error('Error generating caption:', error);
      toast.dismiss();
      toast.error("Failed to generate caption. Please try again.");
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const surpriseMe = async () => {
    setIsGeneratingCaption(true);
    toast.loading("Brewing something unexpected...");

    try {
      const { data, error } = await supabase.functions.invoke('generate-caption', {
        body: { 
          type: 'surprise'
        }
      });

      if (error) throw error;

      const caption = data.caption;
      const newElement: MemeElement = {
        id: Date.now().toString(),
        type: 'text',
        content: caption,
        x: canvasRef.current!.offsetWidth / 2 - 100,
        y: 50,
        fontSize,
        fontFamily,
        color: textColor,
        textAlign
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElement(newElement.id);
      saveToHistory(newElements, backgroundImage);
      
      toast.dismiss();
      toast.success("Surprise caption added!");
    } catch (error) {
      console.error('Error generating surprise caption:', error);
      toast.dismiss();
      toast.error("Failed to generate surprise caption. Please try again.");
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const downloadMeme = () => {
    // This would be implemented with canvas-to-image conversion
    toast.success("Download feature coming soon! 📥");
  };

  const shareToWhatsApp = () => {
    toast.success("WhatsApp sharing coming soon! 💬");
  };

  const shareToInstagram = () => {
    toast.success("Instagram sharing coming soon! 📸");
  };

  const commonEmojis = ["😂", "😭", "💀", "🔥", "💯", "😍", "🤔", "😱", "🙄", "😎", "🤯", "😴", "🤡", "👑", "💰", "🎉"];

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold gradient-text">
              🎭 Meme Generator
            </h1>
            <Button variant="outline" className="bounce-on-hover">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Preview Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Canvas */}
            <Card className="overflow-hidden hover-lift">
              <CardContent className="p-6">
                <div
                  ref={canvasRef}
                  className={`meme-canvas ${backgroundImage ? 'has-image' : ''} cursor-pointer relative`}
                  onClick={handleCanvasClick}
                  style={{
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    aspectRatio: '16/9'
                  }}
                >
                  {!backgroundImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <Upload className="w-16 h-16 mb-4 animate-pulse-soft" />
                      <p className="text-lg font-medium mb-2">Click or drag to upload an image</p>
                      <p className="text-sm">JPG, PNG, GIF up to 10MB</p>
                    </div>
                  )}
                  
                  {/* Render elements */}
                  {elements.map((element) => (
                    <div
                      key={element.id}
                      className={`absolute select-none ${
                        selectedElement === element.id ? 'ring-2 ring-primary ring-offset-2' : ''
                      } ${isDragging && selectedElement === element.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                      style={{
                        left: element.x,
                        top: element.y,
                        fontSize: element.fontSize,
                        fontFamily: element.fontFamily === 'impact' ? 'Impact, Arial Black' : 
                                   element.fontFamily === 'comic' ? 'Comic Sans MS' : 'Arial',
                        color: element.color,
                        textAlign: element.textAlign,
                        textShadow: element.type === 'text' ? '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' : undefined,
                        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                        zIndex: selectedElement === element.id ? 10 : 1,
                        userSelect: 'none'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, element.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElement(element.id);
                      }}
                      onDoubleClick={() => handleDoubleClick(element.id, element.type)}
                    >
                      {editingElement === element.id ? (
                        <input
                          type="text"
                          defaultValue={element.content}
                          className="bg-transparent border-none outline-none text-inherit font-inherit"
                          style={{ 
                            fontSize: 'inherit',
                            fontFamily: 'inherit',
                            color: 'inherit',
                            textAlign: 'inherit',
                            textShadow: 'inherit',
                            width: 'auto',
                            minWidth: '100px'
                          }}
                          autoFocus
                          onBlur={(e) => handleTextEdit(element.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleTextEdit(element.id, e.currentTarget.value);
                            }
                            if (e.key === 'Escape') {
                              setEditingElement(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        element.content
                      )}
                      
                      {selectedElement === element.id && !editingElement && (
                        <button
                          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs hover:scale-110 transition-transform z-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteElement(element.id);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </CardContent>
            </Card>

            {/* AI Description */}
            <Card className="control-panel animate-slide-up">
              <Label className="text-base font-semibold mb-3 block">
                ✨ AI Description & Captions
              </Label>
              <Textarea
                placeholder="Describe your meme or let AI generate a caption..."
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                className="mb-3"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={generateCaption} 
                  variant="outline" 
                  className="flex-1"
                  disabled={isGeneratingCaption || !aiDescription.trim()}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Caption
                </Button>
                <Button 
                  onClick={surpriseMe} 
                  variant="outline" 
                  className="flex-1"
                  disabled={isGeneratingCaption}
                >
                  🎲 Surprise Me
                </Button>
              </div>
            </Card>
          </div>

          {/* Controls Panel */}
          <div className="space-y-6">
            {/* Action Buttons */}
            <Card className="control-panel animate-fade-in">
              <Label className="text-base font-semibold mb-3 block">
                🛠️ Quick Actions
              </Label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button onClick={addText} variant="outline" size="sm">
                  <Type className="w-4 h-4 mr-2" />
                  Add Text
                </Button>
                <Button onClick={undo} variant="outline" size="sm" disabled={historyIndex === 0}>
                  <Undo className="w-4 h-4 mr-2" />
                  Undo
                </Button>
                <Button onClick={redo} variant="outline" size="sm" disabled={historyIndex === history.length - 1}>
                  <Redo className="w-4 h-4 mr-2" />
                  Redo
                </Button>
                <Button 
                  onClick={() => selectedElement && deleteElement(selectedElement)} 
                  variant="outline" 
                  size="sm"
                  disabled={!selectedElement}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </Card>

            {/* Text Controls */}
            <Card className="control-panel animate-fade-in">
              <Label className="text-base font-semibold mb-3 block">
                📝 Text Settings
              </Label>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm mb-2 block">Font Family</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="impact">Impact (Classic Meme)</SelectItem>
                      <SelectItem value="arial">Arial</SelectItem>
                      <SelectItem value="comic">Comic Sans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm mb-2 block">Font Size: {fontSize}px</Label>
                  <Slider
                    value={[fontSize]}
                    onValueChange={(value) => setFontSize(value[0])}
                    max={80}
                    min={12}
                    step={2}
                  />
                </div>
                
                <div>
                  <Label className="text-sm mb-2 block">Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-12 h-10 p-1 border rounded"
                    />
                    <div className="flex gap-1">
                      {['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00'].map(color => (
                        <button
                          key={color}
                          className="w-8 h-8 rounded border-2 border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          onClick={() => setTextColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm mb-2 block">Text Alignment</Label>
                  <div className="flex gap-1">
                    {[
                      { value: 'left', icon: AlignLeft },
                      { value: 'center', icon: AlignCenter },
                      { value: 'right', icon: AlignRight }
                    ].map(({ value, icon: Icon }) => (
                      <Button
                        key={value}
                        variant={textAlign === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTextAlign(value as typeof textAlign)}
                        className="flex-1"
                      >
                        <Icon className="w-4 h-4" />
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Emoji Picker */}
            <Card className="control-panel animate-fade-in">
              <Label className="text-base font-semibold mb-3 block">
                😄 Emoji Stickers
              </Label>
              <div className="grid grid-cols-8 gap-2">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    className="text-2xl p-2 rounded hover:bg-muted bounce-on-hover"
                    onClick={() => addEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </Card>

            {/* Generate & Share */}
            <Card className="control-panel animate-fade-in">
              <Label className="text-base font-semibold mb-3 block">
                🚀 Export & Share
              </Label>
              <div className="space-y-2">
                <Button 
                  onClick={downloadMeme} 
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
                  size="lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Meme
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={shareToWhatsApp} variant="outline" size="sm">
                    💬 WhatsApp
                  </Button>
                  <Button onClick={shareToInstagram} variant="outline" size="sm">
                    📸 Instagram
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;