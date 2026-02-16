
import React, { useState } from 'react';
import { EntityType, RelationshipType } from '../../types/ontology';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Save, X } from 'lucide-react';
import { toast } from "sonner";

interface RelationBuilderProps {
    entityTypes: Record<string, EntityType>;
    onSave: (relation: RelationshipType) => void;
    onCancel: () => void;
}

export function RelationBuilder({ entityTypes, onSave, onCancel }: RelationBuilderProps) {
    const [sourceId, setSourceId] = useState<string>("");
    const [targetId, setTargetId] = useState<string>("");
    const [relationName, setRelationName] = useState<string>("");
    const [description, setDescription] = useState<string>("");

    const handleSave = () => {
        if (!sourceId || !targetId || !relationName) {
            toast.error("Please fill in all required fields (Source, Target, Relation Name)");
            return;
        }

        // Basic validation: Name should be UPPER_SNAKE_CASE conventionally
        const formattedName = relationName.toUpperCase().replace(/\s+/g, '_');

        const newRelation: RelationshipType = {
            name: formattedName,
            from: sourceId,
            to: targetId,
            description: description,
            properties: {} // Future: Add property builder
        };

        onSave(newRelation);
    };

    const entities = Object.keys(entityTypes);

    return (
        <Card className="w-full max-w-2xl mx-auto border-2 border-primary/20">
            <CardHeader>
                <CardTitle>Create New Relationship</CardTitle>
                <CardDescription>Define how two entity types interact.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Flow Visualization */}
                <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg border border-dashed">
                    <div className="text-center w-1/3">
                        <div className={`p-3 rounded-md font-bold mb-2 transition-colors ${sourceId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {sourceId || "?"}
                        </div>
                        <span className="text-xs text-muted-foreground">Source Entity</span>
                    </div>

                    <div className="flex-1 flex flex-col items-center px-4">
                        <div className="text-xs font-mono mb-1 text-muted-foreground">
                            {relationName ? relationName.toUpperCase().replace(/\s+/g, '_') : "RELATION_NAME"}
                        </div>
                        <ArrowRight className="text-muted-foreground w-full" />
                    </div>

                    <div className="text-center w-1/3">
                        <div className={`p-3 rounded-md font-bold mb-2 transition-colors ${targetId ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {targetId || "?"}
                        </div>
                        <span className="text-xs text-muted-foreground">Target Entity</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Source Entity</Label>
                        <Select value={sourceId} onValueChange={setSourceId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select source..." />
                            </SelectTrigger>
                            <SelectContent>
                                {entities.map(e => (
                                    <SelectItem key={e} value={e}>{e}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Target Entity</Label>
                        <Select value={targetId} onValueChange={setTargetId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select target..." />
                            </SelectTrigger>
                            <SelectContent>
                                {entities.map(e => (
                                    <SelectItem key={e} value={e}>{e}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Relation Name (Verb)</Label>
                    <Input
                        placeholder="e.g. VISITED, BELONGS_TO, AUTHORED"
                        value={relationName}
                        onChange={(e) => setRelationName(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">Will be automatically converted to UPPER_CASE</p>
                </div>

                <div className="space-y-2">
                    <Label>Description (Optional)</Label>
                    <Input
                        placeholder="Explain the nature of this relationship..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={onCancel}>
                    <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
                <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" /> Create Relation
                </Button>
            </CardFooter>
        </Card>
    );
}
