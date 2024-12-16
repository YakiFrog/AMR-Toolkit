import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaHome, FaMap } from 'react-icons/fa';
import { getDB } from '../../db';

interface NavItemData {
  id: string;
  order: number;
  href: string;
  label: string;
}

interface NavItem extends NavItemData {
  icon: React.ReactNode;
}

interface NavItemProps extends NavItem {
  isActive: boolean;
  onDragStart: (e: React.DragEvent, item: NavItem) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetItem: NavItem) => void;
  onDragLeave: () => void;  // 追加
}

const NavItem: React.FC<NavItemProps> = ({ 
  id, href, icon, label, order, isActive, onDragStart, onDragOver, onDrop, onDragLeave  // onDragLeave を追加
}) => (
  <div
    draggable
    onDragStart={(e) => onDragStart(e, { id, href, icon, label, order })}
    onDragOver={onDragOver}
    onDrop={(e) => onDrop(e, { id, href, icon, label, order })}
    onDragLeave={onDragLeave}
    className="relative group cursor-move"
  >
    <Link href={href} className="block">
      <div className={`p-3 rounded-lg hover:bg-gray-700 transition-colors ${
        isActive ? 'bg-gray-700' : ''
      }`}>
        {icon}
        <div className="absolute left-full ml-4 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg 
                      opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap
                      pointer-events-none z-[9999] transform translate-y-[-50%] top-1/2">
          {label}
        </div>
      </div>
    </Link>
  </div>
);

export const Sidebar: React.FC = () => {
  const router = useRouter();
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | null>(null);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // DBからナビゲーションアイテムを読み込む
  useEffect(() => {
    const loadItems = async () => {
      try {
        const db = await getDB();
        const items = await db.getAll('sidebarItems');
        
        if (items.length === 0) {
          const defaultItems: NavItemData[] = [
            {
              id: 'home',
              order: 0,
              href: '/home',
              label: 'ホーム'
            },
            {
              id: 'pgm-viewer',
              order: 1,
              href: '/pgm-viewer',
              label: 'PGM ビューアー'
            }
          ];
          
          const tx = db.transaction('sidebarItems', 'readwrite');
          await Promise.all(defaultItems.map(item => tx.store.put(item)));
          await tx.done;

          setNavItems(defaultItems.map(item => ({
            ...item,
            icon: getIconForId(item.id)
          })));
        } else {
          setNavItems(items
            .sort((a, b) => a.order - b.order)
            .map(item => ({
              ...item,
              icon: getIconForId(item.id)
            })));
        }
      } catch (error) {
        console.error('Failed to load sidebar items:', error);
      }
    };

    loadItems();
  }, []);

  const getIconForId = (id: string) => {
    switch (id) {
      case 'home':
        return <FaHome className="w-6 h-6 text-white" />;
      case 'pgm-viewer':
        return <FaMap className="w-6 h-6 text-white" />;
      default:
        return null;
    }
  };

  const handleDragStart = (e: React.DragEvent, item: NavItem) => {
    e.dataTransfer.setData('text/plain', item.id);
  };

  const handleDragOver = (e: React.DragEvent, targetItem: NavItem) => {
    e.preventDefault();
    const targetElement = itemRefs.current[targetItem.id];
    if (!targetElement) return;

    const rect = targetElement.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    
    setDraggedOver(targetItem.id);
    setDragPosition(position);
  };

  const handleDragLeave = useCallback(() => {
    setDraggedOver(null);
    setDragPosition(null);
  }, []);

  const handleDrop = async (e: React.DragEvent, targetItem: NavItem) => {
    e.preventDefault();
    const draggedItemId = e.dataTransfer.getData('text/plain');
    const draggedItem = navItems.find(item => item.id === draggedItemId);
    
    if (draggedItem && draggedItem.id !== targetItem.id) {
      const newItems = [...navItems];
      const draggedIndex = navItems.findIndex(item => item.id === draggedItem.id);
      let targetIndex = navItems.findIndex(item => item.id === targetItem.id);
      
      newItems.splice(draggedIndex, 1);
      if (dragPosition === 'after') {
        targetIndex += 1;
      }
      newItems.splice(targetIndex, 0, draggedItem);

      // 順序を更新
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        order: index
      }));
      
      setNavItems(updatedItems);

      // DBに保存
      const db = await getDB();
      const tx = db.transaction('sidebarItems', 'readwrite');
      await Promise.all(updatedItems.map(item => {
        const { icon, ...itemWithoutIcon } = item;
        return tx.store.put(itemWithoutIcon);
      }));
      await tx.done;
    }
    
    setDraggedOver(null);
    setDragPosition(null);
  };
  
  return (
    <div className="w-16 h-screen bg-gray-800 fixed left-0 top-0 flex flex-col items-center py-4">
      {navItems.map((item) => (
        <div
          key={item.id}
          ref={el => { itemRefs.current[item.id] = el }}
          className="relative mb-8"
        >
          {draggedOver === item.id && dragPosition === 'before' && (
            <div className="absolute w-full h-1 bg-blue-500 -top-2 rounded-full" />
          )}
          <NavItem 
            {...item}
            isActive={router.pathname === item.href}
            onDragStart={handleDragStart}
            onDragOver={(e) => handleDragOver(e, item)}
            onDrop={(e) => handleDrop(e, item)}
            onDragLeave={handleDragLeave}  // 追加
          />
          {draggedOver === item.id && dragPosition === 'after' && (
            <div className="absolute w-full h-1 bg-blue-500 -bottom-2 rounded-full" />
          )}
        </div>
      ))}
    </div>
  );
};
